const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  shopifyCustomerId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fcmTokens: {
    type: [String],
    default: [],
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
