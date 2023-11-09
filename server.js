require('dotenv').config();
const {Client, GatewayIntentBits, EmbedBuilder, WebhookClient} = require('discord.js'); // <-- Fixed import here
const admin = require('firebase-admin');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const webhookClient = new WebhookClient({
  id: process.env.WEBHOOK_ID,
  token: process.env.WEBHOOK_TOKEN,
});
const db = admin.firestore();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});
client.login(process.env.DISCORD_TOKEN);

const app = express();
const port = 3000;

// Middleware registration
app.use(express.static('Public'));
app.use(bodyParser.json());
app.use(cors());

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.mentions.has(client.user)) {
    const randomInsult = await getRandomInsult();
    message.reply(randomInsult);
  }
});

function formatCategoryName(categoryName) {
  return categoryName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
}

// Function to fetch a random insult from the database
async function getRandomInsult() {
  try {
    const insultsRef = db.collection('insults').doc('pingInsults');
    const doc = await insultsRef.get();
    if (doc.exists) {
      const insults = doc.data().insults || [];
      if (insults.length > 0) {
        const randomInsult = insults[Math.floor(Math.random() * insults.length)];
        return randomInsult;
      } else {
        console.error('No insults available in the database');
        return 'No insults available'; // Default response if no insults are available
      }
    } else {
      console.error('Document does not exist');
      return 'Document does not exist'; // Default response if the document does not exist
    }
  } catch (error) {
    console.error('Error fetching insult from database:', error);
    return 'Error fetching insult'; // Default response in case of an error
  }
}

// Route to fetch categories from the database
app.get('/get-categories', async (req, res) => {
  try {
    const categoriesDoc = await db.collection('insults').get();
    const categories = categoriesDoc.docs.map((doc) => doc.id);
    res.json({categories});
  } catch (error) {
    console.error('Error in /get-categories route:', error);
    res.sendStatus(500); // Internal Server Error
  }
});

async function isInsultDuplicate(category, insult) {
  const insultsRef = db.collection('insults').doc(category);
  const doc = await insultsRef.get();
  if (doc.exists) {
    const insults = doc.data().insults || [];
    return insults.includes(insult);
  }
  return false;
}

// Route to submit insultO
app.post('/submit-insult', async (req, res) => {
  console.log('Received request:', req.body); // log the request body
  try {
    const {username, insult, category} = req.body;

    const isDuplicate = await isInsultDuplicate(category, insult);
    if (isDuplicate) {
      res.json({success: false, error: 'Duplicate insult'});
      return;
    }
    const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
    const embed = new EmbedBuilder()
        .setTitle(`New Insult Submission: ${formatCategoryName(category)}`)
        .setDescription(insult)
        .addFields(
            {name: 'Suggested by', value: username, inline: false},
        )
        .setFooter({
          text: 'React to vote',
        });

    const message = await channel.send({embeds: [embed]});
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅';
    const collector = message.createReactionCollector({filter, time: 6000000});
    console.log('Collector created:', collector);

    collector.on('error', (error) => {
      console.error('Collector error:', error);
    });

    const usersWhoReacted = [];

    collector.on('collect', (reaction, user) => {
      console.log('Reaction collected:', reaction.emoji.name);
      if (user.bot) return; // Ignore bot reactions

      if (reaction.count >= 1) { // Adjust this line to account for the bot's own reaction
        usersWhoReacted.push(user.id);
        addInsultToDatabase(category, insult, usersWhoReacted);
        collector.stop();
      }
    });

    const userRef = db.collection('users').doc(username);
    await userRef.set({submissions: admin.firestore.FieldValue.increment(1)}, {merge: true});
    res.json({success: true});
  } catch (error) {
    console.error('Error in /submit-insult endpoint:', error); // log any error
    res.sendStatus(500); // Internal Server Error
  }
});

// Fetch leaderboard
app.get('/leaderboard', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').orderBy('submissions', 'desc').limit(10).get();
    const leaderboard = usersSnapshot.docs.map((doc) => ({
      username: doc.id,
      submissions: doc.data().submissions,
    }));
    res.json({leaderboard});
  } catch (error) {
    console.error('Error in /leaderboard endpoint:', error);
    res.sendStatus(500); // Internal Server Error
  }
});

// Function to add insult to the database
async function addInsultToDatabase(category, insult, usersWhoReacted) {
  try {
    const insultsRef = db.collection('insults').doc(category);
    await insultsRef.update({
      insults: admin.firestore.FieldValue.arrayUnion(insult),
    });
    console.log('Insult added to database:', insult); // log success

    // New embed feedback
    const embed = new EmbedBuilder()
        .setTitle('Insult Added')
        .setDescription(`The insult "${insult}" has been added to the database and upvoted by users: ${usersWhoReacted.join(', ')}.`)
        .setColor('#0099ff');

    webhookClient.send({
      username: 'Kate',
      avatarURL: 'https://i.imgur.com/CCoyl1E.png',
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error adding insult to database:', error); // log any error
  }
}

app.listen(3000, () => {
  console.log(`Server is running on port ${port}`);
});
