const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?html=true";

fetch(url)
    .then(res => res.text())
    .then(text => {
        let regex = /\{name:[^}]+gid:\s*"(\d+)"[^}]+\}/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match[0].includes("SL")) {
                console.log("SL GID:", match[1]);
            }
            if (match[0].includes("kåne") || match[0].includes("kane")) {
                console.log("Skåne GID:", match[1]);
            }
        }
    });
