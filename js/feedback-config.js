/* Feedback settings. After deploying feedback-backend/Code.gs (see feedback-backend/SETUP.md), paste the
   web-app URL (it ends in /exec) into `endpoint`. While it is empty, records wait in the browser and nothing is sent. */
window.PDC.FEEDBACK = {
  endpoint: 'https://script.google.com/macros/s/AKfycbzNLgVG4HfLty9-_T26Zg12nBSs6y0h_LVpYBxB9kXTgpT483OYAZEuKnoXLn5BqvdKdw/exec',
  sendEveryMs: 120000      // how often queued usage records are posted while the page is open
};
