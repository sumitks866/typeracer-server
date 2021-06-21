const express = require('express')
const cors = require('cors')
const http = require('http')
const socketio = require('socket.io')
const axios = require('axios')
const port = 4000

const Room = require('./Room')

const app = express()
const server = http.createServer(app)
// socketio() expects raw http server ... we cannot use express server
const io = socketio(server)

app.use(cors())

let roomsCollection = {}
let idToRoomMap = {}

function updatedRacersState(data) {
  const array = roomsCollection[data.roomID].users
  let racers = array.map((racer)=>{
    if(racer.socketID === data.socketID) {
      return {...racer,speed:data.speed,length:data.length}
    }
    return racer
  })
  return racers
}

function usernameAvailable(roomID, username) {
  if(!roomsCollection[roomID]) {
    return true
  }
  for(let i=0;i<roomsCollection[roomID].users.length;i++) {
    if(roomsCollection[roomID].users[i].username === username) {
      return false
    } 
  }
  return true
}

function removeRacer(racer) {
  if(!roomsCollection[racer.roomID])
    return
  let newRacerState = roomsCollection[racer.roomID].users.filter(r=>{
    return r.socketID!==racer.socketID
  })
  roomsCollection[racer.roomID].setUsers(newRacerState)
  if(roomsCollection[racer.roomID].users.length===0) {
    //console.log(racer.roomID, 'is now empty...clearing...')
    delete roomsCollection[racer.roomID]
  }
}

io.on('connection',(socket)=>{
  //console.log('someone joined')
  socket.on('join',async({username,roomID},confirmationCallback)=>{
    let error = null
    if(!roomsCollection[roomID]) {
      error = null
    }else if(roomsCollection[roomID].isRoomFull()) {
      error = 'This room is already full!'
    }else if(roomsCollection[roomID].isRoomBusy()) {
      error = 'This room is busy'
    }else if (!usernameAvailable(roomID,username)) {
      error = 'Username Unavailable'
    }

    if(!error) {
      socket.join(roomID) 
      //console.log(io.sockets.adapter.rooms)
      idToRoomMap[socket.id] = roomID
      //console.log(idToRoomMap)
      if(!roomsCollection[roomID]) {
        const response = await axios.get('http://api.quotable.io/random')
        let quote = response.data.content
        let room = new Room(io,roomID,quote)
        roomsCollection[roomID] = room
      }
 
      let user = {username:username,roomID:roomID,socketID:socket.id,speed:0,length:0}
      roomsCollection[roomID].setUsers( [...roomsCollection[roomID].users,user] )

      io.to(roomID).emit('room-entry',username)
      io.to(roomID).emit('delta',roomsCollection[roomID].users)
      
      // var sockets = io.sockets.adapter;
      // console.log(sockets)
      confirmationCallback({message:'Room joined successfully',socketID:socket.id})

    } else {
      confirmationCallback({error:error})
    }
    
  })

  socket.on('data-request',(data,dataRequestCallback)=>{
    dataRequestCallback(roomsCollection[data.roomID]?roomsCollection[data.roomID].users:[])
  })
  socket.on('quote-request',(data,quoteRequestCallbak)=>{
    quoteRequestCallbak(roomsCollection[data.roomID]?roomsCollection[data.roomID].quote:'')
  })
  socket.on('user-ready',(userPlayer)=>{
    //console.log(userPlayer.username, 'is ready')
    if(roomsCollection[userPlayer.roomID]) {
      roomsCollection[userPlayer.roomID].incrementReadyUsers(userPlayer)
    }
  })
  socket.on('update',({username,roomID,socketID,length,speed})=>{
    if(roomID) {
      roomsCollection[roomID].setUsers(updatedRacersState({socketID:socket.id,speed:speed,length:length,roomID:roomID}))
    }
    io.to(roomID).emit('delta',roomsCollection[roomID].users)
  })
  socket.on('exit-race',(userPlayer)=>{
    removeRacer(userPlayer)
  })
  socket.on('disconnect',(reason)=>{
    removeRacer({socketID:socket.id,roomID:idToRoomMap[socket.id]})
    delete idToRoomMap[socket.id]
  })

}) 

server.listen(port,()=>{
  console.log('server started on port ',port)
})