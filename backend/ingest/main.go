package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/jackc/pgx/v5/pgxpool"
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

func main() {
	natsURL := flag.String("nats", "nats://localhost:4222", "NATS URL")
	dbURL := flag.String("db", "postgres://saker:saker_dev_password@localhost:55432/saker?sslmode=disable", "PostgreSQL DSN")
	flag.Parse()

	ctx := context.Background()

	dbpool, err := pgxpool.New(ctx, *dbURL)
	if err != nil {
		log.Fatalf("DB connect failed: %v", err)
	}
	defer dbpool.Close()
	log.Printf("Connected to TimescaleDB")

	nc, err := nats.Connect(*natsURL)
	if err != nil {
		log.Fatalf("NATS connect failed: %v", err)
	}
	defer nc.Close()
	log.Printf("Connected to NATS")

	// Batch buffer
	batch := make([]TelemetryPoint, 0, 200)
	flushTicker := time.NewTicker(2 * time.Second)
	defer flushTicker.Stop()

	msgChan := make(chan *nats.Msg, 1000)
	_, err = nc.ChanSubscribe("telemetry.*.*", msgChan)
	if err != nil {
		log.Fatalf("Subscribe failed: %v", err)
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	count := 0
	log.Printf("Ingest service running, waiting for telemetry...")

	for {
		select {
		case msg := <-msgChan:
			var tp TelemetryPoint
			if err := json.Unmarshal(msg.Data, &tp); err != nil {
				log.Printf("Bad message: %v", err)
				continue
			}
			if tp.DeviceID == "" || tp.Point == "" {
				continue
			}
			batch = append(batch, tp)
			count++

			if len(batch) >= 200 {
				flush(ctx, dbpool, &batch)
			}

		case <-flushTicker.C:
			if len(batch) > 0 {
				flush(ctx, dbpool, &batch)
			}

		case <-sigChan:
			log.Printf("Shutting down, flushing %d records", len(batch))
			if len(batch) > 0 {
				flush(ctx, dbpool, &batch)
			}
			log.Printf("Total records ingested: %d", count)
			return
		}
	}
}

func flush(ctx context.Context, dbpool *pgxpool.Pool, batch *[]TelemetryPoint) {
	rows := *batch
	n := len(rows)

	tx, err := dbpool.Begin(ctx)
	if err != nil {
		log.Printf("Begin tx error: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	stmt := `INSERT INTO telemetry (time, tenant_id, site_id, device_id, point, unit, value, quality, source, trace_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	for _, r := range rows {
		t, err := time.Parse(time.RFC3339Nano, r.Time)
		if err != nil {
			continue
		}
		_, err = tx.Exec(ctx, stmt,
			t, r.TenantID, r.SiteID, r.DeviceID, r.Point, r.Unit, r.Value, r.Quality, r.Source, r.TraceID,
		)
		if err != nil {
			log.Printf("Insert error: %v", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Commit error: %v", err)
		return
	}

	log.Printf("Flushed %d records to TimescaleDB", n)
	*batch = rows[:0]
}
