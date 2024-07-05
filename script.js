const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// Read URLs from a file
const urls = fs
  .readFileSync(path.join(__dirname, "urls.txt"), "utf8")
  .split("\n")
  .filter(Boolean);

// Read cookies from a file
const cookiesPath = path.join(__dirname, "cookies.json");
let cookies = [];
if (fs.existsSync(cookiesPath)) {
  cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--start-maximized"],
  });
  const page = await browser.newPage();

  // Set the viewport if --start-maximized doesn't work as expected
  const screenResolution = { width: 1280, height: 800 };
  await page.setViewport(screenResolution);

  // Set cookies
  if (cookies.length > 0) {
    await page.setCookie(...cookies);
    console.log("Cookies have been set.");
  }

  // Initialize a string to hold all the results
  let resultData = "";

  try {
    for (let url of urls) {
      // Navigate to the page
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Function to handle and hide a specific nested element and its children
      await page.evaluate(() => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              // Specifically targeting a div.noticePopup under #andarModal
              const targetElement = document.querySelector("#andarModal");
              if (targetElement) {
                targetElement.style.display = "none"; // Hide the noticePopup
                console.log("noticePopup under #andarModal has been hidden.");

                // Optionally, hide all images under noticePopup
                const images = targetElement.querySelectorAll(":scope > img");
                images.forEach((img) => {
                  img.style.display = "none";
                  console.log("An image under noticePopup has been hidden.");
                });
              }
            });
          });
        });

        // Start observing the document body for added elements
        observer.observe(document.body, {
          childList: true,
        });
      });

      // Wait 5 seconds after hiding the elements
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check if vs-inpage and vs-smart-table are displayed
      const [isVsInpageVisible, isVsSmartTableVisible] = await page.evaluate(
        () => {
          const vsInpage = document.querySelector("#vs-inpage");
          const vsSmartTable = document.querySelector("#vs-smart-table");
          return [
            vsInpage && window.getComputedStyle(vsInpage).display !== "none",
            vsSmartTable &&
              window.getComputedStyle(vsSmartTable).display !== "none",
          ];
        }
      );

      // If vs-inpage is visible, wait 5 seconds and then click it
      if (isVsInpageVisible) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await page.click("#vs-inpage");
      }

      // Wait for the next button to appear
      try {
        await page.waitForSelector(".next-button", { timeout: 10000 });
        console.log(".next-button is present");
      } catch (e) {
        console.log(".next-button is not present");
      }

      // Append results for the current URL to the result data string
      resultData += `URL: ${url}\nvs-inpage Presence: ${
        isVsInpageVisible ? "Present" : "Not Present"
      }\nvs-smart-table Presence: ${
        isVsSmartTableVisible ? "Present" : "Not Present"
      }\nnext-button Presence: ${
        (await page.$(".next-button")) ? "Present" : "Not Present"
      }\n\n`;
    }
  } catch (error) {
    console.error("An error occurred during execution:", error);
  }

  // Write results to a file
  try {
    fs.writeFileSync(path.join(__dirname, "results.txt"), resultData, "utf8");
    console.log("Results have been written to results.txt.");
  } catch (fileError) {
    console.error("Failed to write the results file:", fileError);
  }

  // Clean up and close the browser
})();
