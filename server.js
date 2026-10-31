require("dotenv").config();
const {app} = require('./src/app');
const {connectToDB} = require('./src/config/db');

connectToDB();

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});