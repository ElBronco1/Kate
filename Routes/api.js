const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

router.post('/submit-insult', (req, res) => {
  const {category, insult} = req.body;
  const insultsRef = admin.firestore().collection('insults').doc(category);

  insultsRef.update({
    insults: admin.firestore.FieldValue.arrayUnion(insult),
  })
      .then(() => res.json({success: true}))
      .catch((error) => res.json({success: false, error}));
});

module.exports = router;
