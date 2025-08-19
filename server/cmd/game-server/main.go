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
log.Println("game-server listening on :8080")
log.Fatal(http.ListenAndServe(":8080", nil))
}