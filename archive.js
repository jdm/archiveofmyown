if (typeof(browser) === "undefined") {
    browser = chrome;
}

let tag = null;

function reset() {
    console.log("resetting");
    browser.runtime.sendMessage({ op: "reset" });
    browser.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => browser.tabs.sendMessage(tab.id, {type: 'stop'}))
    setTimeout(() => setup(), 1000);
}

function showSingleDiv(id) {
    const sections = document.querySelectorAll(".section");
    for (const section of sections) {
        section.classList.remove("visible");
    }
    document.querySelector(`#${id}`).classList.add("visible");
}

async function setup() {
    const [currentTab] =
          await browser.tabs.query({active: true, currentWindow: true});
    if (!currentTab.url.startsWith("https://archiveofourown.org/tags/")) {
        showSingleDiv("nontag");
        return;
    }

    await browser.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        files: ["inject.js"],
    });

    showSingleDiv("inputs");

    const url = new URL(currentTab.url);
    const pathParts = url.pathname.split('/');
    tag = decodeURIComponent(pathParts[2].replace('*s*', '/'));

    const data = await browser.storage.local.get({ "archiving": false, "downloadDir": "archive" });
    if (data.archiving) {
        loadUpdatedValues();
        return;
    }

    const directoryInput = document.querySelector("#directory");
    directoryInput.value = data.downloadDir;

    const button = document.querySelector("#archive");
    button.textContent = `Archive ${tag}`;
    button.onclick = doArchive;

    const resetButton = document.querySelector("#reset");
    resetButton.onclick = reset;
}

function loadUpdatedValues() {
    browser.storage.local.get({
        "currentPage": 0,
        "works": [],
        "downloadUrls": [],
        "downloadIndex": 0,
        "pages": null,
        "archiving": false,
        "throttledUntil": null,
    }).then(({ currentPage, works, downloadUrls, downloadIndex, pages, archiving, throttledUntil }) => {
        if (!archiving) {
            showSingleDiv("inputs");
            return;
        }
        updateContent(currentPage, works, downloadUrls, downloadIndex, pages, throttledUntil);
    })
}

browser.runtime.onMessage.addListener(message => {
    switch (message.op) {
    case 'throttled':
        const date = new Date();
        const futureMilliseconds = date.getMilliseconds() + message.throttledFor;
        browser.storage.local.set({ "throttledUntil": futureMilliseconds });
        break;
    default:
        break;
    }
    return false;
});

browser.storage.onChanged.addListener((changes, area) => {
    loadUpdatedValues();
});

(async () => setup())();

function updateContent(currentPage, works, downloadUrls, downloadIndex, pages, throttledUntil) {
    if (currentPage == pages &&
        downloadUrls.length >= works.length &&
        downloadIndex == downloadUrls.length)
    {
        document.querySelector("#complete-reset").onclick = reset;
        showSingleDiv("complete");
        return;
    }

    showSingleDiv("archiving");
    document.querySelector("#tag").textContent = tag;
    document.querySelector("#currentPage").textContent = currentPage;
    document.querySelector("#pages").textContent = pages != null ? pages : "??";
    document.querySelector("#downloadLinks").textContent = downloadUrls.length;
    document.querySelector("#works").textContent = works.length;
    document.querySelector("#downloadIndex").textContent = downloadIndex;
    document.querySelector("#totalDownloads").textContent = downloadUrls.length;

    if (throttledUntil) {
        const now = new Date();
        const date = new Date();
        date.setMilliseconds(throttledUntil);
        if (now < date) {
            const dateString = date.toLocaleString('en-US', {
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
            });
            document.querySelector("#throttledUntil").textContent = dateString;
            document.querySelector("#throttled").classList.remove("hidden");
        }
    } else {
        document.querySelector("#throttled").classList.add("hidden");
    }

    document.querySelector("#abort").onclick = reset;
}

function doArchive() {
    let downloadDir = document.querySelector('#directory').value;
    if (downloadDir != "" && !downloadDir.endsWith('/')) {
        downloadDir += '/';
    }
    console.log(`downloading to ${downloadDir}`);

    const format = document.querySelector('#format').value;

    browser.storage.local.set({ archiving: true, downloadDir: downloadDir });
    browser.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => browser.tabs.sendMessage(tab.id, {type: 'begin', format: parseInt(format) }))
}
