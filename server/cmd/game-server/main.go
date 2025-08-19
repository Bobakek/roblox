package main


import (
"log"
"net/http"
"time"


"mmo-ugc/server/internal/net"
"mmo-ugc/server/internal/sim"
)


func main() {
world := sim.NewWorld()
hub := net.NewHub(world)


go world.Run(20 * time.Millisecond) // 50 Hz тики
go hub.Run()


http.HandleFunc("/ws", hub.HandleWS)
http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK game-server"))
})

http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("healthy"))
})

log.Println("game-server listening on :8080")
log.Fatal(http.ListenAndServe(":8080", nil))
}