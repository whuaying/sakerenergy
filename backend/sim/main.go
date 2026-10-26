package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
)

type TelemetryPoint struct {
	Time     string  `json:"time"`
	TenantID string  `json:"tenant_id"`
	SiteID   string  `json:"site_id"`
	DeviceID string  `json:"device_id"`
	Point    string  `json:"point"`
	Unit     string  `json:"unit"`
	Value    float64 `json:"value"`
	Quality  int     `json:"quality"`
	Source   string  `json:"source"`
	TraceID  string  `json:"trace_id"`
}

type DeviceState struct {
	DeviceID    string
	DeviceType  string
	PowerKW     float64
	ModuleTemp  float64
	FanRPM      float64
	ConnectorTemp float64
	SOC         float64
	TempSpread  float64
	VoltSpread  float64
	PackVoltage float64
	PCS_power   float64
	PCStemp     float64
	BusVoltage  float64
	Online      bool
}

var chargers = []string{"CP-01","CP-02","CP-03","CP-04","CP-05","CP-06","CP-07","CP-08","CP-09","CP-10","CP-11","CP-12"}

// All 12 fault codes from fault_catalog.csv
var allFaults = map[string]bool{
	"F01_module_over_temperature": true,
	"F02_fan_feedback_failure":    true,
	"F03_unexpected_charge_abort": true,
	"F04_communication_offline":   true,
	"F05_connector_over_temp":     true,
	"F06_power_derating":         true,
	"F07_cell_temp_spread":        true,
	"F08_cell_voltage_spread":    true,
	"F09_bms_sampling_anomaly":    true,
	"F10_pcs_alarm":              true,
	"F11_grid_voltage_disturb":   true,
	"F12_sensor_corruption":      true,
}

func main() {
	natsURL := flag.String("nats", "nats://localhost:4222", "NATS URL")
	seed := flag.Int64("seed", 42, "random seed")
	interval := flag.Int("interval", 5, "telemetry interval seconds")
	duration := flag.Int("duration", 0, "run duration seconds")
	fault := flag.String("fault", "", "fault code: F01..F12 or empty for normal")
	flag.Parse()

	nc, err := nats.Connect(*natsURL)
	if err != nil {
		log.Fatalf("NATS connect failed: %v", err)
	}
	defer nc.Close()
	log.Printf("Connected to NATS %s, fault=%q", *natsURL, *fault)

	rng := rand.New(rand.NewSource(*seed))
	states := make(map[string]*DeviceState)
	for _, id := range chargers {
		states[id] = &DeviceState{
			DeviceID: id, DeviceType: "charger", Online: true,
			PowerKW: 40 + rng.Float64()*60, ModuleTemp: 45 + rng.Float64()*10,
			FanRPM: 2200 + rng.Float64()*300, ConnectorTemp: 30 + rng.Float64()*5,
		}
	}
	states["BESS-01"] = &DeviceState{DeviceID: "BESS-01", DeviceType: "battery", Online: true,
		SOC: 55 + rng.Float64()*10, TempSpread: 2 + rng.Float64()*2,
		VoltSpread: 0.05 + rng.Float64()*0.05, PackVoltage: 680 + rng.Float64()*20}
	states["PCS-01"] = &DeviceState{DeviceID: "PCS-01", DeviceType: "pcs", Online: true,
		PCS_power: 50 + rng.Float64()*30, PCStemp: 35 + rng.Float64()*5}
	states["METER-01"] = &DeviceState{DeviceID: "METER-01", DeviceType: "meter", Online: true,
		BusVoltage: 400 + rng.Float64()*5}

	faultStartTime := time.Now().Add(20 * time.Second)
	faultActive := false

	ticker := time.NewTicker(time.Duration(*interval) * time.Second)
	defer ticker.Stop()
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	startTime := time.Now()
	tickCount := 0

	for {
		select {
		case <-ticker.C:
			tickCount++
			now := time.Now().UTC()
			traceID := fmt.Sprintf("sim-%d-%d", *seed, tickCount)

			if *fault != "" && !faultActive && time.Now().After(faultStartTime) {
				faultActive = true
				log.Printf(">>> FAULT INJECTED: %s at tick %d", *fault, tickCount)
			}

			for _, st := range states {
				updateAndPublish(nc, st, states, rng, now, traceID, *fault, faultActive, tickCount)
			}

			if tickCount%12 == 0 {
				log.Printf("Tick %d: %d devices publishing", tickCount, len(states))
			}

			if *duration > 0 && time.Since(startTime) >= time.Duration(*duration)*time.Second {
				return
			}

		case <-sigChan:
			return
		}
	}
}

func updateAndPublish(nc *nats.Conn, st *DeviceState, states map[string]*DeviceState, rng *rand.Rand, now time.Time, traceID, fault string, faultActive bool, tickCount int) {
	pub := func(deviceID, point, unit string, value float64, quality int) {
		tp := TelemetryPoint{
			Time: now.Format(time.RFC3339Nano), TenantID: "default", SiteID: "main",
			DeviceID: deviceID, Point: point, Unit: unit,
			Value: round2(value), Quality: quality, Source: "sim", TraceID: traceID,
		}
		data, _ := json.Marshal(tp)
		nc.Publish(fmt.Sprintf("telemetry.%s.%s", deviceID, point), data)
	}

	switch st.DeviceType {
	case "charger":
		// Normal random walk
		st.PowerKW += (rng.Float64() - 0.5) * 10
		if st.PowerKW < 0 { st.PowerKW = 0 }
		if st.PowerKW > 120 { st.PowerKW = 120 }
		st.ModuleTemp += (rng.Float64() - 0.5) * 2
		st.FanRPM += (rng.Float64() - 0.5) * 100
		st.ConnectorTemp += (rng.Float64() - 0.5) * 1

		// F01: Module overheating (CP-07)
		if fault == "F01_module_over_temperature" && st.DeviceID == "CP-07" && faultActive {
			st.ModuleTemp += 3.0
			st.FanRPM -= 150
			if st.FanRPM < 400 { st.FanRPM = 400 }
		}
		// F02: Fan feedback failure (CP-05)
		if fault == "F02_fan_feedback_failure" && st.DeviceID == "CP-05" && faultActive {
			st.FanRPM = 0 // feedback shows zero
		}
		// F03: Unexpected charge abort (CP-03)
		if fault == "F03_unexpected_charge_abort" && st.DeviceID == "CP-03" && faultActive {
			st.PowerKW = 0
		}
		// F04: Communication offline (CP-09)
		if fault == "F04_communication_offline" && st.DeviceID == "CP-09" && faultActive {
			st.Online = false
		}
		// F05: Connector over temperature (CP-11)
		if fault == "F05_connector_over_temp" && st.DeviceID == "CP-11" && faultActive {
			st.ConnectorTemp += 4.0
		}
		// F06: Power derating (all chargers on BUS-B)
		if fault == "F06_power_derating" && st.DeviceID >= "CP-05" && st.DeviceID <= "CP-08" && faultActive {
			st.PowerKW *= 0.6
		}

		if st.Online {
			pub(st.DeviceID, "power_kw", "kW", st.PowerKW, 0)
			pub(st.DeviceID, "module_temp", "C", st.ModuleTemp, 0)
			pub(st.DeviceID, "fan_rpm", "rpm", st.FanRPM, 0)
			pub(st.DeviceID, "connector_temp", "C", st.ConnectorTemp, 0)
			pub(st.DeviceID, "voltage", "V", 400.0, 0)
			pub(st.DeviceID, "current", "A", st.PowerKW*2.5, 0)
		} else {
			// F04: publish bad quality data
			pub(st.DeviceID, "power_kw", "kW", 0, 2)
		}

	case "battery":
		st.SOC += (rng.Float64() - 0.5) * 0.5
		if st.SOC < 20 { st.SOC = 20 }
		if st.SOC > 90 { st.SOC = 90 }
		st.TempSpread += (rng.Float64() - 0.5) * 0.3
		st.VoltSpread += (rng.Float64() - 0.5) * 0.01

		// F07: Cell temperature spread widening
		if fault == "F07_cell_temp_spread" && faultActive {
			st.TempSpread += 0.7
			if st.TempSpread > 12 { st.TempSpread = 12 }
		}
		// F08: Cell voltage spread
		if fault == "F08_cell_voltage_spread" && faultActive {
			st.VoltSpread += 0.05
			if st.VoltSpread > 0.5 { st.VoltSpread = 0.5 }
		}
		// F09: BMS sampling anomaly (spike)
		if fault == "F09_bms_sampling_anomaly" && faultActive && tickCount%3 == 0 {
			pub(st.DeviceID, "soc", "%", st.SOC+rng.Float64()*20, 2) // bad quality spike
		}

		if fault != "F09_bms_sampling_anomaly" || !faultActive || tickCount%3 != 0 {
			pub(st.DeviceID, "soc", "%", st.SOC, 0)
		}
		pub(st.DeviceID, "temp_spread", "C", st.TempSpread, 0)
		pub(st.DeviceID, "volt_spread", "V", st.VoltSpread, 0)
		pub(st.DeviceID, "pack_voltage", "V", st.PackVoltage, 0)
		pub(st.DeviceID, "current", "A", 100.0, 0)

	case "pcs":
		st.PCS_power += (rng.Float64() - 0.5) * 20
		st.PCStemp += (rng.Float64() - 0.5) * 1

		// F10: PCS alarm / over temperature
		if fault == "F10_pcs_alarm" && faultActive {
			st.PCStemp += 2.5
			if st.PCStemp > 65 { st.PCStemp = 65 }
		}

		pub(st.DeviceID, "power_kw", "kW", st.PCS_power, 0)
		pub(st.DeviceID, "temperature", "C", st.PCStemp, 0)

	case "meter":
		st.BusVoltage += (rng.Float64() - 0.5) * 3

		// F11: Grid voltage disturbance
		if fault == "F11_grid_voltage_disturb" && faultActive {
			st.BusVoltage -= 8.0
			if st.BusVoltage < 355 { st.BusVoltage = 355 }
			for _, s := range states {
				if s.DeviceType == "charger" { s.PowerKW *= 0.85 }
				if s.DeviceType == "pcs" { s.PCS_power *= 0.8 }
			}
		}

		// F12: Sensor data corruption (random spike)
		if fault == "F12_sensor_corruption" && faultActive && tickCount%4 == 0 {
			pub(st.DeviceID, "bus_voltage", "V", st.BusVoltage+rng.Float64()*50, 2)
		} else {
			pub(st.DeviceID, "bus_voltage", "V", st.BusVoltage, 0)
		}
		pub(st.DeviceID, "total_power", "kW", 600+rng.Float64()*50, 0)
	}
}

func round2(v float64) float64 { return float64(int(v*100+0.5)) / 100 }
