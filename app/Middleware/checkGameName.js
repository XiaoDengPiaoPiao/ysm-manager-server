function checkGameName(req, res, next) {
  if (!req.user || !req.user.gameName) {
    return res.status(403).json({
      code: 403,
      message: '请先绑定游戏名才能进行此操作',
      timestamp: new Date().toISOString()
    });
  }
  next();
}

export default checkGameName;
