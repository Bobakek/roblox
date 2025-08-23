package net

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"mmo-ugc/server/internal/auth"
	"mmo-ugc/server/internal/sim"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

type Hub struct {
	world *sim.World
}

func NewHub(w *sim.World) *Hub { return &Hub{world: w} }

func (h *Hub) Run() { /* broadcast routing, auth hooks, etc. */ }

type inbound struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type input struct {
	T  int64   `json:"t"`
	AX float32 `json:"ax"`
	AY float32 `json:"ay"`
	AZ float32 `json:"az"`
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Sec-WebSocket-Protocol")
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	userID, err := auth.ValidateToken(token)
	if err != nil {
		log.Println("unauthorized", r.RemoteAddr)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var respHeader http.Header
	if r.Header.Get("Sec-WebSocket-Protocol") != "" {
		respHeader = http.Header{}
		respHeader.Set("Sec-WebSocket-Protocol", token)
	}
	conn, err := upgrader.Upgrade(w, r, respHeader)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}
	log.Println("client connected:", conn.RemoteAddr())
	defer func() {
		log.Println("client disconnected:", conn.RemoteAddr())
		conn.Close()
	}()

	eid := h.world.NewEntity()
	h.world.BindUser(eid, userID)

	ch := make(chan []byte, 16)
	h.world.AddClient(eid, ch)
	defer func() {
		h.world.RemoveClient(eid)
		h.world.UnbindUser(eid)
		close(ch)
	}()

	go func() {
		for msg := range ch {
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				log.Println("write:", err)
				conn.Close()
				return
			}
		}
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			return
		}
		var in inbound
		if err := json.Unmarshal(msg, &in); err != nil {
			log.Println("unmarshal:", err)
			return
		}
		if in.Type == "input" {
			var inp input
			if err := json.Unmarshal(in.Data, &inp); err != nil {
				log.Println("input unmarshal:", err)
				return
			}
			if !h.world.HasEntity(eid) {
				log.Println("unknown entity:", eid)
				return
			}
			h.world.ApplyInput(sim.Input{T: inp.T, AX: inp.AX, AY: inp.AY, AZ: inp.AZ, EID: eid})
		}
	}
}
