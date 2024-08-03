if (typeof(browser) === "undefined") {
    browser = chrome;
}

function updateWorks(pageNum, urls) {
    browser.storage.local.get({ "works": [], "currentPage": 0 })
        .then(({ works, currentPage }) => {
          let uniqueWorks = urls.filter(url => works.indexOf(url) === -1);
            return browser.storage.local.set({
                "works": works.concat(uniqueWorks),
                "currentPage": Math.max(currentPage, pageNum),
            })
        })
}

function updateDownloads(url) {
    browser.storage.local.get({ "downloadUrls": [] })
        .then(({ downloadUrls }) => {
            return browser.storage.local.set({
                "downloadUrls": downloadUrls.concat([url]),
            })
        })
}

function reset() {
    browser.storage.local.set({
        "pages": null,
        "currentPage": 0,
        "downloadUrls": [],
        "downloadIndex": 0,
        "works": [],
        "archiving": false,
        "downloads": [],
        "throttledUntil": null,
    })
}

browser.runtime.onMessage.addListener(message => {
    console.log(`got message ${JSON.stringify(message)}`);
    switch (message.op) {
    case 'reset':
        reset();
        break;
    case 'pages':
        browser.storage.local.set({ "pages": message.count });
        break;
    case 'page':
        updateWorks(message.pageNum, message.urls)
        break;
    case 'work':
        updateDownloads(message.url);
        break;
    default:
        break;
    }
    return false;
});

function downloadFile(downloadIndex, downloadUrls, downloadPrefix) {
    if (downloadIndex >= downloadUrls.length) {
        return false;
    }
    const url = downloadUrls[downloadIndex];
    const urlParts = (new URL(url)).pathname.split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
    const destination = downloadPrefix + filename;
    console.log(`Downloading ${url} to ${destination}`);
    browser.downloads.download({
        url: url,
        filename: destination,
        saveAs: false,
    })
        .then(item => {
            console.log(`Started downloading ${url}`);
            return browser.storage.local.get({ downloads: {} })
                .then(downloads => {
                    downloads[item.id] = url;
                    return browser.storage.local.set({ downloads: downloads });
                })
        })
        .catch(reason => console.error(`Download of ${url} failed: ${reason}`));
    return true;
}

browser.downloads.onChanged.addListener(delta => {
    browser.storage.local.get({ downloads: {} })
        .then(downloads => {
            if (!(delta.id in downloads)) {
                return;
            }
            if (delta.state === "interrupted") {
                return browser.storage.local.get({ downloadUrls: [] })
                    .then(downloadUrls => {
                        const failedUrl = downloads[delta.id];
                        console.log(`${failedUrl} failed; adding to retry queue.`);
                        downloadUrls.push(failedUrl);
                        return browser.storage.local.set({ downloadUrls: downloadUrls });
                    })
            }
        })
});

browser.alarms.create({ periodInMinutes: 0.025 });
browser.alarms.onAlarm.addListener(() => {
    browser.storage.local.get({ "downloadIndex": 0, "downloadUrls": [], "downloadDir": "" })
        .then(({ downloadIndex, downloadUrls, downloadDir }) => {
            if (downloadFile(downloadIndex, downloadUrls, downloadDir)) {
                return browser.storage.local.set({ "downloadIndex": downloadIndex + 1 });
            }
        })
});
