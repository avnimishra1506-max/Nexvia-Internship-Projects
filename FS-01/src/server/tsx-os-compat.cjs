const os = require("node:os");
const originalUserInfo = os.userInfo.bind(os);

os.userInfo = (...args) => {
  try {
    return originalUserInfo(...args);
  } catch (error) {
    if (error?.code !== "ERR_SYSTEM_ERROR") throw error;
    return {
      username: process.env.USERNAME || process.env.USER || "local",
      uid: -1,
      gid: -1,
      shell: null,
      homedir: os.homedir(),
    };
  }
};
