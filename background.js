function updateWorks(pageNum, urls) {
    chrome.storage.local.get({ "works": [], "currentPage": 0 })
        .then(({ works, currentPage }) => {
            return chrome.storage.local.set({
                "works": works.concat(urls),
                "currentPage": Math.max(currentPage, pageNum),
            })
        })
}

function updateDownloads(url) {
    chrome.storage.local.get({ "downloadUrls": [] })
        .then(({ downloadUrls }) => {
            return chrome.storage.local.set({
                "downloadUrls": downloadUrls.concat([url]),
            })
        })
}

function reset() {
    chrome.storage.local.set({
        "pages": null,
        "currentPage": 0,
        "downloadUrls": [],
        "downloadIndex": 0,
        "works": [],
        "archiving": false,
    })
}

chrome.runtime.onMessage.addListener(message => {
    console.log(`got message ${JSON.stringify(message)}`);
    switch (message.op) {
    case 'reset':
        reset();
        break;
    case 'pages':
        chrome.storage.local.set({ "pages": message.count });
        break;
    case 'page':
        updateWorks(message.pageNum, message.urls)
        break;
    case 'work':
        updateDownloads(message.url);
        break;
    }
    return false;
});

function downloadFile(downloadIndex, downloadUrls, downloadPrefix) {
    if (downloadIndex >= downloadUrls.length) {
        return false;
    }
    // TODO: detect failed download and retry.
    const url = downloadUrls[downloadIndex];
    const urlParts = (new URL(url)).pathname.split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
    const destination = downloadPrefix + filename;
    console.log(`Downloading ${url} to ${destination}`);
    chrome.downloads.download({
        url: url,
        filename: destination,
        saveAs: false,
    })
        .then(item => console.log(`Started downloading ${url}`))
        .catch(reason => console.error(`Download of ${url} failed: ${reason}`));
    return true;
}

chrome.alarms.create({ periodInMinutes: 0.05 });
chrome.alarms.onAlarm.addListener(() => {
    console.log("alarm!");
    chrome.storage.local.get({ "downloadIndex": 0, "downloadUrls": [], "downloadDir": "" })
        .then(({ downloadIndex, downloadUrls, downloadDir }) => {
            if (downloadFile(downloadIndex, downloadUrls, downloadDir)) {
                return chrome.storage.local.set({ "downloadIndex": downloadIndex + 1 });
            }
        })
});
