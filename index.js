const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");
const ObjectId = require("mongodb").ObjectId;
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// const fileUpload = require("express-fileUpload");

const port = process.env.PORT || 5000;

const serviceAccount = require("./ecommerce-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
// app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1wea1.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("e-Commerce");
    const productCollection = database.collection("products");
    const orderedCollection = database.collection("orderedProducts");
    const testimonialCollection = database.collection("testimonials");
    const userCollection = database.collection("users");

    //get all products
    app.get("/products", async (req, res) => {
      const cursor = productCollection.find({});
      const products = await cursor.toArray();
      res.json(products);
    });

    //get single product details
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.json(result);
    });

    // status update order product
    app.put("/orderedProducts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Shipped",
        },
      };
      const result = await orderedCollection.updateOne(query, updateDoc);
      res.json(result);
    });

    // payment update order product
    app.put("/myProducts/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      console.log(payment);
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };
      const result = await orderedCollection.updateOne(query, updateDoc);

      res.json(result);
    });

    //DELETE PRODUCTS
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.json(result);
    });

    //POST
    app.post("/products", async (req, res) => {
      const products = req.body;
      const result = await productCollection.insertOne(products);
      res.json(result);
    });

    //Ordered Product post
    app.post("/orderedProducts", async (req, res) => {
      const order = req.body;
      const result = await orderedCollection.insertOne(order);
      res.json(result);
    });

    //Get All Ordered Product
    app.get("/orderedProducts", async (req, res) => {
      const cursor = orderedCollection.find({});
      const orderedProducts = await cursor.toArray();
      res.json(orderedProducts);
    });

    //Get My order filter by email
    app.get("/orderedProducts/:email", async (req, res) => {
      const result = await orderedCollection
        .find({ email: req.params.email })
        .toArray();
      res.json(result);
    });

    app.get("/myProducts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderedCollection.findOne(query);
      res.json(result);
    });

    //Delete My order
    app.delete("/orderedProducts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderedCollection.deleteOne(query);
      res.json(result);
    });

    //feedback section
    //Post feedback
    app.post("/testimonials", async (req, res) => {
      const name = req.body.name;
      const email = req.body.email;
      const message = req.body.message;
      const rating = req.body.rating;
      const pic = req.files.img;
      const picData = pic.data;
      const encodedPic = picData.toString("base64");
      const imageBuffer = Buffer.from(encodedPic, "base64");
      const comment = {
        name,
        email,
        message,
        rating,

        image: imageBuffer,
      };
      const result = await testimonialCollection.insertOne(comment);
      res.json(result);
    });
    //Get All feedback
    app.get("/testimonials", async (req, res) => {
      const cursor = testimonialCollection.find({});
      const reviews = await cursor.toArray();
      res.json(reviews);
    });

    //Add Product
    //POST
    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.json(result);
    });

    //user and admin section start
    //post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.json(result);
      console.log(result);
    });

    //MakeAdmin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, updateDoc);

          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "You have no permissions to make admin" });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    //user and admin section end

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    });

    console.log(`DB CONNECTED`);
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("E-COMMERCH");
});

app.listen(port, () => {
  console.log(`Running Port ${port}`);
});
