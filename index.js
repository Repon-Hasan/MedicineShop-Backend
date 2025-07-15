const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 3000;
const { ObjectId } = require('mongodb');
const verifyToken = require('./verifyToken');

// app.use(cors({
//   origin: 'https://assignment-12-b71cb.web.app' 
 
// }));
app.use(cors())
app.use(express.json()); // Parse JSON request body
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 

const uri = `${process.env.DB_URL}`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Declare the collection variable outside so it can be accessed in the route
let usersCollection;
let medicinesCollection;
let selectedMedicinesCollection;

async function run() {
  try {
    //await client.connect();
    const database = client.db("myApp"); // Change this to your DB name
    usersCollection = database.collection("users");
     medicinesCollection = database.collection("medicines"); 
     selectedMedicinesCollection = database.collection("SelectedMedicines"); 
        ordersCollection = database.collection("orders"); 
          advertisementsCollection = database.collection("advertisements");
          categoryCollection = database.collection("categories");
          bannersAllCollection = database.collection('banners');

   // console.log("Connected to MongoDB");
  } catch (err) {
    //console.error("MongoDB connection failed:", err);
  }
}
run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Hello World!');
});
// PUT /user/:email
app.put('/user/:email', async (req, res) => {
  const email = req.params.email;
  const updatedData = req.body;

  const result = await usersCollection.updateOne(
    { email },
    { $set: updatedData },
    { upsert: true } // ✅ this will insert if not exists
  );

  res.send(result);
});


// ✅ POST route to save user signup data
app.post('/signup', async (req, res) => {
  const userData = req.body;

  if (!usersCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const result = await usersCollection.insertOne(userData);
    res.status(201).send({ message: "User registered", id: result.insertedId });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).send({ message: "Failed to save user", error });
  }
});


//Get user data
app.get('/user/:email', async (req, res) => {
  const email = req.params.email;

  if (!usersCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const user = await usersCollection.findOne({ email: email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send(user);
  } catch (error) {
    console.error("Error retrieving user:", error);
    res.status(500).send({ message: "Failed to retrieve user", error });
  }
});

//add medicine
// ✅ POST /medicines - Save new medicine
app.post('/medicines', async (req, res) => {
  const medicineData = req.body;

  // Basic validation
  const requiredFields = ['name', 'generic', 'description', 'category', 'company', 'unit', 'price', 'imageURL'];
  for (const field of requiredFields) {
    if (!medicineData[field]) {
      return res.status(400).send({ message: `Missing field: ${field}` });
    }
  }

  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    medicineData.createdAt = new Date().toISOString(); // Add timestamp
    const result = await medicinesCollection.insertOne(medicineData);
    res.status(201).send({ message: "Medicine saved", id: result.insertedId });
  } catch (error) {
    console.error("Error saving medicine:", error);
    res.status(500).send({ message: "Failed to save medicine", error });
  }
});

//Get seller data

// Secured route
app.get("/allMedicines/:email", verifyToken, async (req, res) => {
  const email = req.params.email;

  if (req.user.email !== email) {
    return res.status(403).json({ message: "Forbidden: You can't access other user's data" });
  }

  const medicines = await medicinesCollection.find({ email }).toArray();
  res.send(medicines);
});




//Get all medicine
app.get('/allMedicines',verifyToken, async (req, res) => {
  
  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const medicines = await medicinesCollection.find().toArray();
    res.status(200).json(medicines);
  } catch (error) {
    console.error("Error fetching medicines:", error);
    res.status(500).send({ message: "Failed to fetch medicines", error });
  }
});

// ✅ GET full medicine data by ID — for selecting and saving with sellerEmail
app.get('/allMedicines/details/:id', async (req, res) => {
  const id = req.params.id;

  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const medicine = await medicinesCollection.findOne({ _id: new ObjectId(id) });

    if (!medicine) {
      return res.status(404).send({ message: "Medicine not found" });
    }

    res.status(200).json(medicine); // contains sellerEmail
  } catch (error) {
    console.error("Error fetching medicine by ID:", error);
    res.status(500).send({ message: "Failed to fetch medicine", error });
  }
});

//Get 6 data 
app.get('/latestMedicines', async (req, res) => {
  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const medicines = await medicinesCollection
      .find()
      .sort({ createdAt: -1 }) // Sort by newest
      .limit(6)                // Limit to latest 6
      .toArray();

    res.status(200).json(medicines);
  } catch (error) {
    console.error("Error fetching latest medicines:", error);
    res.status(500).send({ message: "Failed to fetch medicines", error });
  }
});


//Get discount data 
app.get('/discountedMedicines', async (req, res) => {
  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const discountedMedicines = await medicinesCollection
      .find({ discount: { $gt: 0 } })  // Find where discount > 0
      .toArray();

    res.status(200).json(discountedMedicines);
  } catch (error) {
    console.error("Error fetching discounted medicines:", error);
    res.status(500).send({ message: "Failed to fetch discounted medicines", error });
  }
});


// GET /category/:id


app.get('/category/:id', async (req, res) => {
  const id = req.params.id;

  if (!medicinesCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const medicine = await medicinesCollection.findOne({ _id: new ObjectId(id) });

    if (!medicine) {
      return res.status(404).send({ message: "Medicine not found" });
    }

    res.status(200).json(medicine);
  } catch (error) {
    console.error("Error fetching medicine by ID:", error);
    res.status(500).send({ message: "Failed to fetch medicine", error });
  }
});

//selected medicine
app.post('/selectedMedicines', async (req, res) => {
  const { medicine, email } = req.body;

  if (!medicine || !email) {
    return res.status(400).json({ message: 'Medicine data and email are required' });
  }

  try {
    const { _id, ...medicineWithoutId } = medicine; // remove _id
    const result = await selectedMedicinesCollection.insertOne({ ...medicineWithoutId, email });
    res.status(201).json({ message: 'Medicine selected and saved successfully', id: result.insertedId });
  } catch (error) {
    console.error('Error saving selected medicine:', error);
    res.status(500).json({ message: 'Failed to save selected medicine', error });
  }
});

app.get('/selectedMedicines', async (req, res) => {
  try {
    const selectedMedicines = await selectedMedicinesCollection.find().toArray();
    res.status(200).json(selectedMedicines);
  } catch (error) {
    console.error('Error fetching selected medicines:', error);
    res.status(500).json({ message: 'Failed to fetch selected medicines', error });
  }
});

    // === Optionally fetch selected medicines for a user ===
    app.get('/selectedMedicines/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const selected = await selectedMedicinesCollection.find({ email }).toArray();
        res.status(200).json(selected);
      } catch (err) {
        res.status(500).json({ message: 'Error fetching selected medicines', err });
      }
    });


// ✅ Remove a single medicine by ID
app.delete('/selectedMedicines/remove/:id', async (req, res) => {
  try {
    const id = req.params.id.trim();

    const result = await selectedMedicinesCollection.deleteOne({ _id: new ObjectId(id) });
    console.log(result);

    if (result.deletedCount === 1) {
      res.status(200).json({ message: 'Removed selected medicine.' });
    } else {
      res.status(404).json({ message: 'Medicine not found.' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(400).json({ message: 'Invalid ID or failed to delete.' });
  }
});



// ✅ Clear entire cart for a user
app.delete('/selectedMedicines/clear/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const result = await selectedMedicinesCollection.deleteMany({ email });
    res.status(200).json({ message: 'Cart cleared successfully.', deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear cart.', err });
  }
});


// ✅ Create Payment Intent


app.post('/create-payment-intent', async (req, res) => {
  const { amount, email, cartItems } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount), // Amount in cents
      currency: 'usd',
      metadata: {
        email,
        items: JSON.stringify(cartItems.map(item => item.name).join(', ')),
      },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).send({ error: error.message });
  }
});

//save order
app.post('/save-order', async (req, res) => {
  const { cartItems, email, total, paymentId } = req.body;

  if (!ordersCollection) {
    return res.status(500).send({ message: "Database not initialized." });
  }

  try {
    const order = {
      email,
      cartItems,
      total,
      paymentId,
      status: 'Paid', // assume paid for now
      date: new Date().toISOString()
    };

    const result = await ordersCollection.insertOne(order);
    res.status(201).json({ message: 'Order saved successfully', orderId: result.insertedId });
  } catch (error) {
    console.error("Error saving order:", error);
    res.status(500).json({ message: 'Failed to save order', error });
  }
});


//Get seller data
app.get('/seller-dashboard/:email', async (req, res) => {
  const sellerEmail = req.params.email;

  try {
    // Fetch only orders that contain seller's items
    const orders = await ordersCollection.find({
      'cartItems.sellerEmail': sellerEmail
    }).toArray();

    const relevantOrders = orders.map(order => {
      const items = order.cartItems.filter(i => i.sellerEmail === sellerEmail);
      const subtotal = items.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
      return {
        ...order,
        cartItems: items,
        total: subtotal
      };
    });

    const totalRevenue = relevantOrders.reduce((acc, o) => acc + o.total, 0);
    const paidTotal = relevantOrders.filter(o => o.status === 'Paid').reduce((acc, o) => acc + o.total, 0);
    const pendingTotal = totalRevenue - paidTotal;

    const medicineStats = {};
    for (const order of relevantOrders) {
      for (const item of order.cartItems) {
        const key = item.name;
        if (!medicineStats[key]) {
          medicineStats[key] = { name: key, sold: 0, revenue: 0 };
        }
        medicineStats[key].sold += item.quantity || 1;
        medicineStats[key].revenue += item.price * (item.quantity || 1);
      }
    }

    const topMedicines = Object.values(medicineStats).sort((a, b) => b.sold - a.sold).slice(0, 5);
    const recentOrders = relevantOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    res.json({
      summary: {
        totalRevenue,
        paidTotal,
        pendingTotal
      },
      topMedicines,
      recentOrders
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Error fetching dashboard data' });
  }
});



// Fetch seller-specific payment history with Stripe status
app.get('/seller/payments/:email', async (req, res) => {
  const sellerEmail = req.params.email;

  try {
    // Fetch all orders that contain cartItems with sellerEmail matching the param
    const sellerOrders = await ordersCollection.find({
      'cartItems.sellerEmail': sellerEmail
    }).toArray();

    res.status(200).json(sellerOrders);
  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).json({ message: 'Failed to fetch seller orders', error });
  }
});


// POST: Add or update ad
app.post('/advertisements', async (req, res) => {
  const { imageURL, description, email, status } = req.body;
  if (!imageURL || !description || !email) {
    return res.status(400).json({ message: 'Required fields missing.' });
  }

  try {
    const result = await advertisementsCollection.insertOne({
      imageURL,
      description,
      email,
      status,
      createdAt: new Date()
    });
    res.status(201).json({ message: 'Advertisement added.', id: result.insertedId });
  } catch (err) {
    console.error('Error saving ad:', err);
    res.status(500).json({ message: 'Failed to save advertisement.' });
  }
});

app.get('/advertisements',verifyToken, async (req, res) => {
  try {
    const advertisements = await advertisementsCollection.find().toArray();
    res.status(200).json(advertisements);
  } catch (error) {
    console.error('Error fetching advertisements:', error);
    res.status(500).json({ message: 'Failed to fetch advertisements.' });
  }
});


// GET: Fetch ads for seller
app.get('/advertisements/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const ads = await advertisementsCollection.find({ email }).sort({ createdAt: -1 }).toArray();
    res.json(ads);
  } catch (err) {
    console.error('Error fetching ads:', err);
    res.status(500).json({ message: 'Failed to fetch advertisements.' });
  }
});

app.get('/user/payments/:email', async (req, res) => {
  const buyerEmail = req.params.email;

  try {
    const userOrders = await ordersCollection.find({ email: buyerEmail }).toArray();
    res.status(200).json(userOrders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch user orders', error });
  }
});


// Admin Dashboard Summary Route
app.get('/admin/summary', async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();

    const totalRevenue = orders.reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);
    const paidTotal = orders
      .filter((o) => o.status === 'Paid')
      .reduce((acc, o) => acc + (parseFloat(o.total) || 0), 0);
    const pendingTotal = totalRevenue - paidTotal;

    res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      paidTotal: Number(paidTotal.toFixed(2)),
      pendingTotal: Number(pendingTotal.toFixed(2)),
    });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard summary' });
  }
});


// GET /admin/users — Get all users
app.get('/admin/users', async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error });
  }
});

// PATCH /admin/user-role/:id — Promote or demote user
app.patch('/admin/user-role/:id', async (req, res) => {
  const id = req.params.id;
  const { role } = req.body;
  if (!['admin', 'seller', 'user'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'User not found or role unchanged' });
    }
    res.status(200).json({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update role', error });
  }
});

// POST: Add new category
app.post('/categories', async (req, res) => {
  try {
    const { categoryName, categoryImage } = req.body;

    const existingCategory = await categoryCollection.findOne({ categoryName });

    if (existingCategory) {
      return res.status(200).json({ message: 'Category already exists' });
    }

    const result = await categoryCollection.insertOne({
      categoryName,
      categoryImage,
    });

    res.status(201).json({ message: 'Category added', id: result.insertedId });
  } catch (err) {
    console.error('Error adding category:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.get('/categories', async (req, res) => {
  try {
    const categories = await categoryCollection.find().toArray();
    res.status(200).json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// PUT: Update category
app.put('/categories/:id', async (req, res) => {
  const { categoryName, categoryImage } = req.body;
  const id = req.params.id;

  if (!categoryName) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    const result = await categoryCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { categoryName, ...(categoryImage && { categoryImage }) } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update category', error: err });
  }
});

// DELETE: Remove category
app.delete('/categories/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await categoryCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category', error: err });
  }
});

app.get('/admin/orders',verifyToken, async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching all user payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history', error });
  }
});

app.delete('/admin/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});


// GET /admin/sales?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/admin/sales', async (req, res) => {
  const { start, end } = req.query;
  const filter = {};

  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = new Date(start);
    if (end) filter.date.$lte = new Date(end);
  }

  try {
    const sales = await ordersCollection.find(filter).toArray();
    res.json(sales);
  } catch (err) {
    console.error('Error fetching sales report:', err);
    res.status(500).json({ message: 'Failed to fetch sales report' });
  }
});


app.post('/banners', async (req, res) => {
  const banner = req.body;

  try {
    const exists = await  bannersAllCollection.findOne({ _id: banner._id });

    if (exists) {
      return res.status(400).send({ message: 'Already added to banner' });
    }

    const result = await  bannersAllCollection.insertOne(banner);
    res.send({ success: true, message: 'Added to banner successfully', result });
  } catch (error) {
    res.status(500).send({ message: 'Failed to add banner', error });
  }
});

// GET all banners
app.get('/banners', async (req, res) => {
  try {
    const result = await  bannersAllCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to get banners', error });
  }
});

app.delete('/banners/:id', async (req, res) => {
  const id = req.params.id;
  const result = await bannersAllCollection.deleteOne({ _id: id });

  if (result.deletedCount === 1) {
    res.send({ success: true, message: "Removed from slider" });
  } else {
    res.status(404).send({ message: "Banner not found" });
  }
});

app.post('/jwt',(req,res)=>{
  const {email}=req.body;
  const user={email}
  const token= jwt.sign(user,process.env.JWT_SECRET_KEY,{expiresIn: '30d'})
  
  res.send({token})
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports=app
