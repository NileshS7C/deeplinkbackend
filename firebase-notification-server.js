// Backend Server Example for Firebase Cloud Messaging
// This is a Node.js/Express server that sends real system notifications
require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");
const os = require("os");
const mongoose = require("mongoose");
const User = require("./User");
const crypto = require("crypto");

const app = express();
const PORT = process.env.EXPO_PUBLIC_PORT || 3000;
const path = require("path");

// Serve .well-known for deep linking
app.use("/.well-known", express.static(path.join(__dirname, ".well-known")));
// Get local IP address for React Native development
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === "IPv4" && !interface.internal) {
        return interface.address;
      }
    }
  }
  return "localhost";
}

// Middleware
app.use(
  cors({
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Initialize Firebase Admin SDK
// Download your service account key from Firebase Console
// Project Settings > Service Accounts > Generate new private key
const serviceAccount = require("../backend-example/fir-analytics-75b8b-firebase-adminsdk-fbsvc-ae8f8741c6.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optional: Add your database URL if using Realtime Database
  // databaseURL: 'https://your-project-id-default-rtdb.firebaseio.com'
});

// MongoDB connection
const MONGODB_URI =
  process.env.EXPO_PUBLIC_MONGODB_URI || "mongodb://localhost:27017/sunrisetrade";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// HMAC verification middleware for Shopify webhooks
function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.EXPO_PUBLIC_SHOPIFY_SECRET;
  console.log("secret>>>>>", secret);
  if (!secret) {
    console.error("❌ SHOPIFY_SECRET is not set");
    return res.status(500).send("Missing secret");
  }
  console.log("typeof req.body:", typeof req.body);
  console.log("isBuffer:", Buffer.isBuffer(req.body));
  // console.log("req.body (hex):", req.body.toString("hex").slice(0, 100)); // first 100 chars
  // console.log("req.body (base64):", req.body.toString("base64"));
  console.log("secret (length):", secret.length);
  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body) // use req.body as raw buffer
    .digest("base64");

  console.log("✅ Shopify HMAC     :", hmacHeader);
  console.log("✅ Calculated HMAC  :", digest);

  const digestBuf = Buffer.from(digest, "base64");
  const hmacBuf = Buffer.from(hmacHeader || "", "base64");

  if (
    digestBuf.length !== hmacBuf.length ||
    !crypto.timingSafeEqual(digestBuf, hmacBuf)
  ) {
    console.error("❌ Invalid Shopify webhook signature");
    return res.status(401).send("Invalid signature");
  }

  next();
}

// Secure Shopify order-created webhook (must be BEFORE express.json!)
app.post(
  "/api/webhook/order-created",
  express.raw({ type: "application/json" }), // Raw parser only for this route
  verifyShopifyWebhook,
  async (req, res) => {
    try {
      console.log("order is created successfully");
      const order = JSON.parse(req.body.toString("utf8"));
      console.log("order>>", order);
      const shopifyCustomerId = order.customer?.id?.toString();
      const customerName = order.customer?.first_name || "Customer";
      if (!shopifyCustomerId) {
        console.warn("No customer ID in order payload");
        return res.status(200).send("No customer ID");
      }
      const user = await User.findOne({ shopifyCustomerId });
      if (!user) {
        console.warn("No user found for customer ID", shopifyCustomerId);
        return res.status(200).send("No user for this customer");
      }
      const tokens = [...new Set(user.fcmTokens.filter(Boolean))];
      console.log("tokens>>>>>", tokens);
      if (!tokens.length) {
        console.warn("No FCM tokens for user", shopifyCustomerId);
        return res.status(200).send("No tokens");
      }
      const message = {
        tokens,
        notification: {
          title: `Thank you for your order, ${customerName}!`,
          body: `Your order ${order.name} has been placed successfully.`,
        },
        data: {
          orderId: order.id?.toString() || "",
          screen: "Orders",
        },
        android: {
          priority: "high",
          notification: { sound: "default" },
        },
        apns: {
          payload: {
            aps: { sound: "default", badge: 1 },
          },
        },
      };
      console.log("starting notificaiton sending.......");
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log("stop notificaiton sending.......", response);
      // Cleanup invalid tokens
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          [
            "messaging/invalid-registration-token",
            "messaging/registration-token-not-registered",
            "messaging/invalid-argument",
            "messaging/registration-token-not-registered",
            "messaging/invalid-recipient"
          ].includes(resp.error?.code)
        ) {
          console.log(`Removing invalid token: ${tokens[idx]} - Reason: ${resp.error?.code}`);
          invalidTokens.push(tokens[idx]);
        }
      });
      if (invalidTokens.length) {
        await User.updateOne(
          { shopifyCustomerId },
          { $pull: { fcmTokens: { $in: invalidTokens } } }
        );
        console.log("Removed invalid tokens from DB:", invalidTokens);
      }
      if (response.failureCount > 0) {
        console.warn(
          "Some notifications failed to deliver:",
          response.responses
        );
      }
      console.log("Notification sent succcessfully");
      res.status(200).send("Notification sent");
    } catch (error) {
      console.error("❌ Error in order-created webhook:", error);
      res.status(500).send("Internal server error");
    }
  }
);

app.use(express.json());

// Endpoint to send notifications
app.post("/api/send-notification", async (req, res) => {
  try {
    const { token, notification, data, android, apns } = req.body;

    if (!token) {
      return res.status(400).json({
        error: "FCM token is required",
      });
    }

    if (!notification || !notification.title || !notification.body) {
      return res.status(400).json({
        error: "Notification title and body are required",
      });
    }

    // Prepare the message
    const message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          title: notification.title,
          body: notification.body,
          color: "#FF4081",
          sound: "default",
          ...android?.notification,
        },
        ...android,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
        ...apns,
      },
    };

    console.log("📤 Sending notification:", {
      title: notification.title,
      body: notification.body,
      token: token.substring(0, 20) + "...", // Log partial token for security
    });

    // Send the notification
    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent successfully:", response);

    res.status(200).json({
      success: true,
      messageId: response,
      message: "Notification sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending notification:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Endpoint to send notifications to multiple tokens
app.post("/api/send-multicast-notification", async (req, res) => {
  try {
    const { tokens, notification, data, android, apns } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        error: "Array of FCM tokens is required",
      });
    }

    if (!notification || !notification.title || !notification.body) {
      return res.status(400).json({
        error: "Notification title and body are required",
      });
    }

    // Prepare the multicast message
    const message = {
      tokens: tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          title: notification.title,
          body: notification.body,
          color: "#FF4081",
          sound: "default",
          ...android?.notification,
        },
        ...android,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body,
            },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
        ...apns,
      },
    };

    console.log(
      `📤 Sending multicast notification to ${tokens.length} devices:`,
      {
        title: notification.title,
        body: notification.body,
      }
    );

    // Send the multicast notification
    const response = await admin.messaging().sendMulticast(message);

    console.log("✅ Multicast notification sent:", {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    res.status(200).json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
      message: "Multicast notification sent",
    });
  } catch (error) {
    console.error("❌ Error sending multicast notification:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Register FCM token for a Shopify customer
app.post("/api/register-fcm-token", async (req, res) => {
  console.log("Hello from register fcm token");
  try {
    const { shopifyCustomerID, token } = req.body;
    console.log("shopifyCustomerID", shopifyCustomerID)
    const shopifyCustomerId = shopifyCustomerID?.split("/").pop();

    console.log(" id>>>>><<<><>><><><><", shopifyCustomerId);
    console.log(" shopifyCustomerId", shopifyCustomerId);

    console.log(" token", token);
    if (!shopifyCustomerId || !token) {
      return res
        .status(400)
        .json({ error: "shopifyCustomerId and token are required" });
    }
    let user = await User.findOne({ shopifyCustomerId });
    if (!user) {
      user = new User({ shopifyCustomerId, fcmTokens: [token] });
      await user.save();
      return res.status(200).json({ success: true, created: true });
    }
    // Use $addToSet to avoid duplicate tokens
    const result = await User.updateOne(
      { shopifyCustomerId },
      { $addToSet: { fcmTokens: token } }
    );
    if (result.modifiedCount > 0) {
      return res.status(200).json({ success: true, added: true });
    }
    return res.status(200).json({ success: true, duplicate: true });
  } catch (error) {
    console.error("❌ Error in /api/register-fcm-token:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Firebase Notification Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(PORT, () => {
  const localIP = getLocalIPAddress();

  console.log(`🚀 Firebase Notification Server running on port ${PORT}`);
  console.log(`\n📱 For React Native development, use these URLs:`);
  console.log(`   Local IP: http://${localIP}:${PORT}/api/send-notification`);
  console.log(`   Health check: http://${localIP}:${PORT}/health`);
  console.log(`\n💻 For web development:`);
  console.log(`   Localhost: http://localhost:${PORT}/api/send-notification`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔧 Update your React Native app with:`);
  console.log(`   const DEV_IP = '${localIP}';`);
  console.log(
    `\n💡 Make sure your phone/emulator is on the same WiFi network!`
  );
});

module.exports = app;
