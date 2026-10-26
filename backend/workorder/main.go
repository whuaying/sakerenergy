package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var dbpool *pgxpool.Pool

// Dangerous action keywords that must never be allowed (Safety Gate)
// Chinese keywords written as unicode escapes to avoid source encoding issues
var forbiddenKeywords = []string{
	"\u505c\u673a", // 停机
	"\u5408\u95f8", // 合闸
	"\u5206\u95f8", // 分闸
	"\u590d\u4f4d", // 复位
	"\u89e3\u9501", // 解锁
	"\u65ad\u7535", // 断电
	"\u9001\u7535", // 送电
	"shutdown", "trip", "reclose", "reset", "unlock", "de-energize",
	"charge_enable", "discharge_enable", "contactor_close",
}

type WorkOrderRequest struct {
	EventID  int    `json:"event_id" binding:"required"`
	Assignee string `json:"assignee"`
	Note     string `json:"note"`
}

type StatusUpdate struct {
	Status   string `json:"status" binding:"required"`
	Approval string `json:"approval"`
	Feedback string `json:"feedback"`
}

func main() {
	var err error
	dbpool, err = pgxpool.New(context.Background(),
		"postgres://saker:saker_dev_password@localhost:55432/saker?sslmode=disable")
	if err != nil {
		log.Fatalf("DB connect failed: %v", err)
	}
	defer dbpool.Close()

	r := gin.Default()

	// API routes
	api := r.Group("/api")
	{
		api.POST("/workorders", createWorkOrder)
		api.GET("/workorders", listWorkOrders)
		api.GET("/workorders/:id", getWorkOrder)
		api.PUT("/workorders/:id/status", updateStatus)
		api.GET("/events", listEvents)
		api.GET("/events/:id", getEvent)
		api.GET("/alarms", listAlarms)
		api.GET("/telemetry/latest", latestTelemetry)
	}

	log.Println("WorkOrder service starting on :8080")
	r.Run(":8080")
}

func safetyGateCheck(note string) bool {
	for _, kw := range forbiddenKeywords {
		if strings.Contains(note, kw) {
			return false
		}
	}
	return true
}

func createWorkOrder(c *gin.Context) {
	var req WorkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !safetyGateCheck(req.Note) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Safety Gate: request contains forbidden equipment control action",
		})
		return
	}

	var woID int
	err := dbpool.QueryRow(context.Background(), `
		INSERT INTO work_orders (event_id, status, assignee, checks)
		VALUES ($1, 'NEW', $2, $3) RETURNING wo_id
	`, req.EventID, req.Assignee, `{"note": "`+req.Note+`"}`).Scan(&woID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update event status
	dbpool.Exec(context.Background(),
		"UPDATE events SET status='TRIAGED', updated_at=NOW() WHERE event_id=$1", req.EventID)

	c.JSON(http.StatusCreated, gin.H{"wo_id": woID, "status": "NEW"})
}

func listWorkOrders(c *gin.Context) {
	rows, err := dbpool.Query(context.Background(), `
		SELECT wo_id, event_id, status, assignee, created_at, updated_at
		FROM work_orders ORDER BY created_at DESC LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type WO struct {
		WOID     int       `json:"wo_id"`
		EventID  int       `json:"event_id"`
		Status   string    `json:"status"`
		Assignee string    `json:"assignee"`
		Created  time.Time `json:"created_at"`
		Updated  time.Time `json:"updated_at"`
	}
	var results []WO
	for rows.Next() {
		var w WO
		rows.Scan(&w.WOID, &w.EventID, &w.Status, &w.Assignee, &w.Created, &w.Updated)
		results = append(results, w)
	}
	c.JSON(http.StatusOK, results)
}

func getWorkOrder(c *gin.Context) {
	id := c.Param("id")
	var wo struct {
		WOID    int
		EventID int
		Status  string
		Assignee string
		Checks  json.RawMessage
	}
	err := dbpool.QueryRow(context.Background(), `
		SELECT wo_id, event_id, status, assignee, checks
		FROM work_orders WHERE wo_id=$1
	`, id).Scan(&wo.WOID, &wo.EventID, &wo.Status, &wo.Assignee, &wo.Checks)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, wo)
}

func updateStatus(c *gin.Context) {
	id := c.Param("id")
	var req StatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Safety gate on feedback too
	if !safetyGateCheck(req.Feedback) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Safety Gate: forbidden control action in feedback"})
		return
	}

	validStatuses := map[string]bool{
		"NEW": true, "TRIAGED": true, "INVESTIGATING": true,
		"AWAITING_HUMAN": true, "READY_TO_VERIFY": true,
		"RESOLVED": true, "REOPENED": true,
	}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	_, err := dbpool.Exec(context.Background(), `
		UPDATE work_orders SET status=$1, approval_by=$2, updated_at=NOW(),
		closed_at = CASE WHEN $1='RESOLVED' THEN NOW() ELSE closed_at END
		WHERE wo_id=$3
	`, req.Status, req.Approval, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": req.Status, "updated": true})
}

func listEvents(c *gin.Context) {
	rows, err := dbpool.Query(context.Background(), `
		SELECT event_id, event_type, first_seen, last_seen, status, affected_devices
		FROM events ORDER BY first_seen DESC LIMIT 50
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Event struct {
		EventID  int                    `json:"event_id"`
		Type     string                 `json:"event_type"`
		FirstSeen time.Time             `json:"first_seen"`
		LastSeen  time.Time             `json:"last_seen"`
		Status   string                 `json:"status"`
		Devices  []string               `json:"affected_devices"`
	}
	var results []Event
	for rows.Next() {
		var e Event
		var devicesJSON []byte
		rows.Scan(&e.EventID, &e.Type, &e.FirstSeen, &e.LastSeen, &e.Status, &devicesJSON)
		json.Unmarshal(devicesJSON, &e.Devices)
		results = append(results, e)
	}
	c.JSON(http.StatusOK, results)
}

func getEvent(c *gin.Context) {
	id := c.Param("id")
	var event struct {
		EventID  int
		Type     string
		FirstSeen time.Time
		LastSeen  time.Time
		Status   string
		Devices  []byte
		RootCause string
	}
	err := dbpool.QueryRow(context.Background(), `
		SELECT event_id, event_type, first_seen, last_seen, status, affected_devices, root_cause
		FROM events WHERE event_id=$1
	`, id).Scan(&event.EventID, &event.Type, &event.FirstSeen, &event.LastSeen,
		&event.Status, &event.Devices, &event.RootCause)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, event)
}

func listAlarms(c *gin.Context) {
	rows, err := dbpool.Query(context.Background(), `
		SELECT alarm_id, device_id, alarm_code, severity, observed_at, message, event_id
		FROM alarms ORDER BY observed_at DESC LIMIT 100
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Alarm struct {
		AlarmID  int       `json:"alarm_id"`
		DeviceID string    `json:"device_id"`
		Code     string    `json:"alarm_code"`
		Severity int       `json:"severity"`
		Observed time.Time `json:"observed_at"`
		Message  string    `json:"message"`
		EventID  *int      `json:"event_id"`
	}
	var results []Alarm
	for rows.Next() {
		var a Alarm
		rows.Scan(&a.AlarmID, &a.DeviceID, &a.Code, &a.Severity, &a.Observed, &a.Message, &a.EventID)
		results = append(results, a)
	}
	c.JSON(http.StatusOK, results)
}

func latestTelemetry(c *gin.Context) {
	rows, err := dbpool.Query(context.Background(), `
		SELECT DISTINCT ON (device_id, point) device_id, point, value, unit, time
		FROM telemetry ORDER BY device_id, point, time DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Reading struct {
		DeviceID string  `json:"device_id"`
		Point    string  `json:"point"`
		Value    float64 `json:"value"`
		Unit     string  `json:"unit"`
		Time     time.Time `json:"time"`
	}
	var results []Reading
	for rows.Next() {
		var r Reading
		rows.Scan(&r.DeviceID, &r.Point, &r.Value, &r.Unit, &r.Time)
		results = append(results, r)
	}
	c.JSON(http.StatusOK, results)
}
