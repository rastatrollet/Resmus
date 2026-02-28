fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?gid=1824714927&single=true&output=csv')
    .then(r => r.text())
    .then(text => console.log(text.split('\n').slice(0, 30).join('\n')));
