const { MongoClient } = require('mongodb');
const cors = require('cors');
const ObjectId = require('mongodb').ObjectID;
const express = require('express')
const app = express();
require('dotenv').config()
const port = process.env.PORT || 9000;
const bodyparse = require('body-parser');
app.use(bodyparse.json())
app.use(bodyparse.urlencoded({ extended: true }));
app.use(cors());
//const routes=require('./routes')

async function main() {

  const uri = "mongodb+srv://db-user-expense-management:ExpenseSystem@cluster0.ub7tx.mongodb.net/expenseSystem?retryWrites=true&w=majority";
  const client = new MongoClient(uri);

  try {

    app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Hi!'
      })
    })

    app.get('/all_users',async (req, res) => {
      var user = req.body;
      /*req format
      {
        "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
        
      }*/
      var allUsers = await getAllOtherUsers(client,user.userId);
      //console.log(youOweDetail)
      res.status(200).json({
        success: true,
        message: 'All users list',
        data: allUsers
      })
    })

    app.get('/my_groups', async (req, res) => {
      var user = req.body;
      /*req format
      {
        "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var myGroups = await MyGroupsList(client, ObjectId(user.userId));
      //console.log(youOweDetail)
      res.status(200).json({
        success: true,
        message: 'my groups list',
        data: myGroups
      })
    })

    app.get('/group_users', async (req, res) => {
      var group = req.body;
      /*req format
      {
        "userId":"615afeabd20a2cf1a41e37f2",(current logged in user)
        "groupName":"Group1"
      }*/
      var groupUsers = await getGroupUsersList(client, group.groupName, group.userId);
      //console.log(youOweDetail)
      res.status(200).json({
        success: true,
        message: 'selected group users list',
        data: groupUsers
      })
    })

    app.get('/current_user_detail', async (req, res) => {
      var user = req.body;
      /*req format
      {
        "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var data = await getCurrentUserData(client, user.userId);
      //console.log(youOweDetail)
      res.status(200).json({
        success: true,
        message: 'Current user details',
        data: data
      })
    })

    app.put('/update_user',async (req,res) => {
      /*req format
      {
        "userId":"615afeabd20a2cf1a41e37f2",(current logged in user)
        "username":"Test",
        "email":"test@gmail.com",
        "password":"test@123"
      }*/
      var user=req.body;
      if(!(await findUserNameExists(client,user.username,user.userId))){
        if(!(await findUserEmailExists(client,user.email,user.userId))){
          await updateUser(client,user);
          res.status(200).json({
            success: true,
            message: 'Updated user info'
          })
        }
        else{
          res.status(500).json({
            success: false,
            message: 'User email already exists'
          })
        }
      }
      else{
        res.status(500).json({
          success: false,
          message: 'User name already exists'
        })
      }
    })

    app.get('/dashboard_owing_details', async (req, res) => {
      await client.connect();
      var user = req.body;
      /*
      req format
      {
        "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var detail = await youOweDetails(client, ObjectId(user.userId));
      var youOweDetail = [];
      await Promise.all(detail.map(async (element) => {
        var obj = {
          you_owe_to_user_id: element._id,
          you_owe_to_user_name: await getUserName(client, ObjectId(element._id)),
          amount: element.totalOweAmount
        };
        youOweDetail.push(obj)
      }));
      detail = await youAreOwedDetails(client, ObjectId(user.userId));
      var youAreOwedDetail = [];
      await Promise.all(detail.map(async (element) => {
        var obj = {
          you_are_owed_from_user_id: element._id,
          you_are_owed_from_user_name: await getUserName(client, ObjectId(element._id)),
          amount: element.totalOwedAmount
        }        
        youAreOwedDetail.push(obj)
      }));
      res.status(200).json({
        success: true,
        message: 'Dashboard owe and owed details',
        youOweDetail: youOweDetail,
        youAreOwedDetail:youAreOwedDetail
      })
    })

    app.post('/create_group', async (req, res) => {
      /*req format
      {
        "group_name":"Group6",
        "users":["Test","Test1"] //should have current user name and sharing user names
      }*/
      var newGroup = req.body;
      var user_ids = [];
      await Promise.all(newGroup.users.map(async (i) => {
        user_ids.push(await getUserId(client, i));
      }));
      newGroup = {
        group_name: newGroup.group_name,
        user_ids: user_ids,
        group_created_timestamp: new Date()
      }
      var resu = await findGroupNameExists(client, newGroup.group_name);
      if (!resu) {
        const result = await createGroup(client, newGroup);
        res.status(200).json({
          success: true,
          message: 'Created group',
          id: result.insertedId
        })
      }
      else {
        res.status(500).json({
          success: false,
          message: 'Group name already exists'
        })
      }

    })

    app.post('/create_expense', async (req, res) => {
      /*req format
      {
       "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
       "description":"Test expense",
       "amount":1000,
       "users":["Test","Test1"],
       "groupname":"Group1"
      }*/
      var newExpense = req.body;
      var shared_user_ids = [];
      var group_id = await getGroupId(client, newExpense.groupname);

      var paid_by_user_id = ObjectId(newExpense.userId);
      var paid_by_user_name = await getUserName(client,paid_by_user_id);

      await Promise.all(newExpense.users.map(async (i) => {
        shared_user_ids.push(await getUserId(client, i));
      }));

      newExpense = {
        description: newExpense.description,
        amount: newExpense.amount,
        users: newExpense.users,
        group_id: group_id,
        paid_by_user_id: paid_by_user_id,
        shared_user_ids: shared_user_ids,
        paid_by_user_name: paid_by_user_name,
        each_user_amount: await newExpense.amount / (shared_user_ids.length +1),
        spent_timestamp: new Date()
      }


      var result = await createExpense(client, newExpense);
      var result1 = await addPaymentsRecord(client, newExpense, result.insertedId);
      res.status(200).json({
        success: true,
        message: 'added expense',
        id: result.insertedId,
        payment_ids: result1.insertedIds
      })
    })

    app.listen(port, async () => {
      console.log(`Server listening on port ${port}!`);
      await client.connect();
    })

    app.put('/settle_all', async (req, res) => {
      /*req format
      {
        "fromUserId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var user = req.body;
      await settleAllOwes(client, user.fromUserId);
      res.status(200).json({
        success: true,
        message: 'settled all users'
      })
    })

    app.put('/settle', async (req, res) => {
      /*req format
      {
        "fromUserId":"615afedcd20a2cf1a41e37f3",(current logged in user)
        "toUserId":"615afeabd20a2cf1a41e37f2"
      }*/
      var user = req.body;
      await settleSingleUserOwe(client, user.fromUserId, user.toUserId);
      res.status(200).json({
        success: true,
        message: 'settled user : ' + user.toUserId
      })
    })

    app.put('/request_all', async (req, res) => {
      /*req format
      {
        "toUserId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var user = req.body;
      await requestAllOwes(client, user.toUserId);
      res.status(200).json({
        success: true,
        message: 'requested all users'
      })
    })

    app.put('/request', async (req, res) => {
      /*req format
      {
        "fromUserId":"615afedcd20a2cf1a41e37f3",
        "toUserId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var user = req.body;
      await requestSingleUserOwe(client, user.fromUserId, user.toUserId);
      res.status(200).json({
        success: true,
        message: 'requested user : ' + user.fromUserId
      })
    })

    app.get('/get_notification', async (req, res) => {
      var user = req.body;
      /*
      req format
      {
        "userId":"615afeabd20a2cf1a41e37f2"(current logged in user)
      }*/
      var notification = await getSettledNotification(client, ObjectId(user.userId));
      var settled_notification = [];
      await Promise.all(notification.map(async (element) => {
        var obj = await getUserName(client, ObjectId(element.from_user_id)) + " has settled you ₹" + element.amount + " . on" + element.settled_timestamp;
        settled_notification.push(obj)
      }));
      var notification = await getRequestNotification(client, ObjectId(user.userId));
      var request_notification = [];
      await Promise.all(notification.map(async (element) => {
        var obj = await getUserName(client, ObjectId(element.to_user_id)) + " has requested you ₹" + element.amount + " . on" + element.request_timestamp;
        request_notification.push(obj)
      }));

      res.status(200).json({
        success: true,
        message: 'Settled and request notifications',
        settled_notification: settled_notification,
        request_notification: request_notification
      })
    })

  }

  finally {
    await client.close();
  }
}

main().catch(console.error);

async function updateUser(client,info){
  const result = await client.db("expenseSystem").collection("users").updateOne({ _id: ObjectId(info.userId) }, { $set: { name:info.username,email_id:info.email,password:info.password } });
  //console.log(result.modifiedCount);
}

async function getCurrentUserData(client,currentUserId){
  const result = await client.db("expenseSystem").collection("users").findOne({ _id: ObjectId(currentUserId) });
  return result;
}

async function createGroup(client, newGroup) {
  const result = await client.db("expenseSystem").collection("groups").insertOne(newGroup, await updateUsersGroup(client, newGroup.user_ids, newGroup.group_name));
  return result;
}

async function updateUsersGroup(client, ids, groupName) {
  const result = await client.db("expenseSystem").collection("users").updateMany({ _id: { $in: ids } }, { $push: { groups: groupName } });
}

async function findGroupNameExists(client, groupName) {
  const result = await client.db("expenseSystem").collection("groups").findOne({ group_name: groupName });
  if (result != (undefined || null)) {
    return true;
  }
  return false;
}

async function findUserNameExists(client, userName,currentUserId) {
  const result = await client.db("expenseSystem").collection("users").findOne({ _id:{$ne:ObjectId(currentUserId)},name: userName });
  if (result != (undefined || null)) {
    return true;
  }
  return false;
}

async function findUserEmailExists(client, userEmail,currentUserId) {
  const result = await client.db("expenseSystem").collection("users").findOne({ _id:{$ne:ObjectId(currentUserId)},email_id: userEmail });
  if (result != (undefined || null)) {
    return true;
  }
  return false;
}


async function MyGroupsList(client, userID) {
  const result = (await client.db("expenseSystem").collection("users").findOne({ _id: userID })).groups;
  return result;
}

async function getGroupUsersList(client, groupName, currentUserId) {
  const result = (await client.db("expenseSystem").collection("groups").findOne({ group_name: groupName })).user_ids;
  var groupUserNames = []
  await Promise.all(result.map(async (i) => {
    if (i != currentUserId)
      groupUserNames.push(await getUserName(client, ObjectId(i)));
  }));
  return groupUserNames;
}
async function getAllOtherUsers(client, currentUserId) {
  const result = await client.db("expenseSystem").collection("users").find({language:"english"});
  var allUsers = []
  await result.forEach(i => {
    if (i._id != currentUserId)
      allUsers.push(i.name);
  });
  return allUsers;
}

async function getUserId(client, userName) {
  const result = await client.db("expenseSystem").collection("users").findOne({ name: userName });
  return result._id;
}

async function getUserName(client, userId) {
  const result = await client.db("expenseSystem").collection("users").findOne({ _id: userId });
  return result.name;
}

async function getGroupId(client, groupName) {
  const result = await client.db("expenseSystem").collection("groups").findOne({ group_name: groupName });
  return result._id;
}

async function createExpense(client, newExpense) {
  const result = await client.db("expenseSystem").collection("expenses").insertOne(newExpense);
  return result;
}

async function addPaymentsRecord(client, newExpense, expenseID) {
  var paymentsList = [];
  newExpense.shared_user_ids.forEach(element => {
    var paymentRecord = {
      expense_id: expenseID,
      group_id: newExpense.group_id,
      from_user_id: element,
      to_user_id: newExpense.paid_by_user_id,
      amount: newExpense.each_user_amount,
      request_notification: false,
      request_timestamp: null,
      settled: false,
      settled_timestamp: null
    }
    paymentsList.push(paymentRecord);
  });
  const result = await client.db("expenseSystem").collection("payments").insertMany(paymentsList);
  return result;
}

async function youOweDetails(client, userId) {

  const pipeline = [{
    $match: { "from_user_id": userId, "settled": false }
  },
  {
    $group: {
      _id: "$to_user_id",
      totalOweAmount: { $sum: "$amount" },
    }
  }];

  const aggCursor =await client.db("expenseSystem").collection("payments").aggregate(pipeline);

  var result = []
  await aggCursor.forEach(element => {
    result.push(element);
  });
  return result;
}

async function youAreOwedDetails(client, userId) {

  const pipeline = [{
    $match: { "to_user_id": userId, "settled": false }
  },
  {
    $group: {
      _id: "$from_user_id",
      totalOwedAmount: { $sum: "$amount" },
    }
  }];

  const aggCursor =await client.db("expenseSystem").collection("payments").aggregate(pipeline);

  var result = [];
  await aggCursor.forEach(element => {
    result.push(element)
  });
  return result
}

async function settleAllOwes(client, fromUserId) {
  const result = await client.db("expenseSystem").collection("payments").updateMany({ from_user_id: ObjectId(fromUserId) }, { $set: { settled: true, settled_timestamp: new Date() } });
  //console.log(result.modifiedCount)
}
async function settleSingleUserOwe(client, fromUserId, toUserId) {
  const result = await client.db("expenseSystem").collection("payments").updateMany({ from_user_id: ObjectId(fromUserId), to_user_id: ObjectId(toUserId) }, { $set: { settled: true, settled_timestamp: new Date() } });
  //console.log(result.modifiedCount)
}

async function requestAllOwes(client, fromUserId) {
  const result = await client.db("expenseSystem").collection("payments").updateMany({ to_user_id: ObjectId(fromUserId),settled:false }, { $set: { request_notification: true, request_timestamp: new Date() } });
  //console.log(result.modifiedCount)
}
async function requestSingleUserOwe(client, fromUserId, toUserId) {
  const result = await client.db("expenseSystem").collection("payments").updateMany({ from_user_id: ObjectId(fromUserId), to_user_id: ObjectId(toUserId),settled:false }, { $set: { request_notification: true, request_timestamp: new Date() } });
  //console.log(result.modifiedCount)
}

async function getSettledNotification(client, currentUserId) {

  const cursor = await client.db("expenseSystem").collection("payments").find({ "to_user_id": currentUserId, "settled": true }, { $orderby: { settled_timestamp: 1 } });
  var result = [];
  await cursor.forEach(element => {
    result.push(element)
  });
  return result
}

async function getRequestNotification(client, currentUserId) {

  const cursor = await client.db("expenseSystem").collection("payments").find({ "from_user_id": currentUserId, "request_notification": true, "settled": false }, { $orderby: { request_timestamp: 1 } });
  var result = [];
  await cursor.forEach(element => {
    result.push(element)
  });
  return result
}
