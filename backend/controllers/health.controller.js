function healthCheck(_req, res) {
  res.json({ status: "ok" });
}

module.exports = {
  healthCheck,
};
