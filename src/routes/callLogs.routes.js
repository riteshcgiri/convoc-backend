const express = require("express")
const router = express.Router()
const protect = require('../middlewares/auth.middleware')
const {getCallLogs, deleteCallLog} = require('../controllers/calls/callLog.controller')

router.get("/",protect ,getCallLogs );
router.delete("/:logId",protect ,deleteCallLog );


module.exports = router;
