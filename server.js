const express = require('express');
const app = express();
const port = 8080;

app.use(express.static('./'));

// Add error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 