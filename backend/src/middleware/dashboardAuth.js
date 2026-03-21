const config = require("../config");

function dashboardAuth(req, res, next) {
  const providedPassword = req.get("x-dashboard-password");

  if (!config.dashboardPassword) {
    return res.status(500).json({ error: "DASHBOARD_PASSWORD non configure" });
  }

  if (!providedPassword || providedPassword !== config.dashboardPassword) {
    return res.status(401).json({ error: "Acces non autorise" });
  }

  return next();
}

module.exports = {
  dashboardAuth
};
