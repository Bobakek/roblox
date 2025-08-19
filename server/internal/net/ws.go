package net
import (
"encoding/json"
"log"
"net/http"


"github.com/gorilla/websocket"
"mmo-ugc/server/internal/sim"
)


var upgrader = websocket.Upgrader{ CheckOrigin: func(r *http.Request) bool { return true } }


type Hub struct {
world *sim.World
}


func NewHub(w *sim.World) *Hub { return &Hub{world: w} }


func (h *Hub) Run() { /* broadcast routing, auth hooks, etc. */ }


type inbound struct {
Type string `json:"type"`
Data json.RawMessage `json:"data"`
}


type input struct {
T int64 `json:"t"`
AX float32 `json:"ax"`
AY float32 `json:"ay"`
AZ float32 `json:"az"`
}


func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
conn, err := upgrader.Upgrade(w, r, nil)
if err != nil { log.Println("upgrade:", err); return }
defer conn.Close()


// TODO: auth (Nakama), создание EntityID
for {
_, msg, err := conn.ReadMessage()
if err != nil { log.Println("read:", err); return }
var in inbound
if err := json.Unmarshal(msg, &in); err != nil { continue }
if in.Type == "input" {
var inp input
if err := json.Unmarshal(in.Data, &inp); err == nil {
// TODO: маппинг на конкретного EntityID
// h.world.ApplyInput(sim.Input{T: inp.T, AX: inp.AX, AY: inp.AY, AZ: inp.AZ, EID: ...})
}
}
}
}