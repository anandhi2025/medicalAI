// const mongoose = require("mongoose");

// const chatSchema = new mongoose.Schema({
//   userId: String,
//   disease: String,
//   query: String,
//   response: String,
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model("Chat", chatSchema);


const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  userId: String,
  disease: String,
  query: String,
  response: String,
  publicationsCount: Number,
  trialsCount: Number,
}, { timestamps: true }); // adds createdAt automatically

module.exports = mongoose.model("Chat", ChatSchema);