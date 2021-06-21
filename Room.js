module.exports =  class Room {
  constructor(io,roomID,quote) {
    this.io = io
    this.roomID = roomID,
    this.timestamp = new Date()
    this.users = []
    this.quote = quote
    this.busy = false
    this.readyUsersMap = {}
   
  }
  incrementReadyUsers(user) {
    let readyUsers = 0
    this.readyUsersMap[user.username] = true
    for(let key in this.readyUsersMap) {
      readyUsers++
    }
    if(readyUsers === this.users.length) {
      this.busy = true
      this.io.to(this.roomID).emit('readyForGameFlare','ready for game')
      this.startGameFlare()
    }
  }
  setQuote(quote) {
    this.quote = quote
  }
  addUser(user) {
    this.users.push(user)
  }
  setUsers(users) {
    this.users = users
  }

  isRoomFull() {
    return this.users.length === 5
  }
  isRoomBusy() {
    return this.busy
  }

  startGameFlare() {
    setTimeout(()=>{
      this.io.to(this.roomID).emit('startGameFlare','start game')
      this.endGameFlare()
    },3000)
  }

  endGameFlare() {
    setTimeout(()=>{
      //this.busy = false
      this.io.to(this.roomID).emit('endGameFlare','end game')
    },5000)
  }

  timeout() {
    setTimeout(() => {
      console.log('timeout',this.roomID)
    }, 5000);
  }
}