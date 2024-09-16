import { AG_GRID_LOCALE_VN } from "./lib/ag_grid_vi.js";

const loadingDiv = document.querySelector("#loading");
const sumaryDiv = document.querySelector("#sumary");
const sumaryTable = document.querySelector("#sumaryTable");
const agChartDiv = document.querySelector("#agChart");
const themeBtn = document.querySelector("#theme");
const dataSelect = document.querySelector("#data-select");
const fetchDataBtn = document.querySelector("#fetch-data-btn");
const tableEle = document.querySelector("#myTable");

let darkMode = false;
let agChart, agChartOptions;

(() => {
  initTheme();
  initSelect();
})();

// theme

function initTheme() {
  if (localStorage.getItem("theme") === "true") {
    setDarkMode(true);
  }

  themeBtn.addEventListener("click", () => {
    darkMode = !darkMode;
    setDarkMode(darkMode);
  });
}
function setDarkMode(dark) {
  darkMode = dark;
  tableEle.className = dark ? "ag-theme-quartz-dark" : "ag-theme-quartz";
  if (agChart) {
    agChartOptions.theme = dark ? "ag-default-dark" : "ag-default";
    agCharts.AgCharts.update(agChart, agChartOptions);
  }
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark);
}

async function initSelect() {
  loadingDiv.innerHTML = "Đang tải danh sách file...";
  // create select
  [
    { label: "Toàn bộ dữ liệu", value: "all" },
    {
      group: "Theo ngân hàng",
      prefix: "byBank",
      options: ["VCB", "BIDV", "Vietin", "Agri"],
    },
    {
      group: "Theo ngày",
      prefix: "byDate",
      options: Array.from({ length: 13 }).map((_, i) => `${padZero(i + 1)}-09`),
    },
    {
      group: "Theo file",
      prefix: "byFile",
      options: [
        "MTTQ_VCB_1-10",
        "MTTQ_VCB_11",
        "MTTQ_VCB_12",
        "MTTQ_VCB_13",
        "MTTQ_BIDV_1-12",
        "CTTU_Vietinbank_10-12",
        "MTTQ_Agribank_9-13",
      ],
    },
  ].forEach((d) => {
    const toPath = (o, prefix) =>
      "../data/output/" + (prefix ? prefix + "/" : "") + o + ".csv.gz";
    if (d.group) {
      dataSelect.innerHTML += `
        <optgroup label="${d.group}">
          ${d.options
            .map((o) => `<option value="${toPath(o, d.prefix)}">${o}</option>`)
            .join("")}
          </optgroup>`;
    } else if (d.value) {
      dataSelect.innerHTML += `<option value="${toPath(d.value)}">
        ${d.label}
      </option>`;
    }
  });

  // fetch file size
  const options = dataSelect.querySelectorAll("option");
  loadingDiv.innerHTML = "Đang tải kích thước file...";
  await Promise.all(
    Array.from(options).map(async (o) => {
      const res = await fetch(o.value, {
        method: "HEAD",
      });
      const length = res.headers.get("Content-Length");
      const size = formatSize(length);
      o.innerHTML += ` (${size})`;
    })
  );
  loadingDiv.innerHTML = "Vui lòng chọn dữ liệu muốn xem. Rồi bấm Tải";

  fetchDataBtn.addEventListener("click", () => {
    fetchDataBtn.disabled = true;
    fetchData(dataSelect.value + "?v=" + Date.now())
      .then(() => {})
      .catch((err) => {
        alert("ERROR: " + err);
      })
      .finally(() => {
        fetchDataBtn.disabled = false;
      });
  });
}

let gridApi;
async function fetchData(filePath) {
  loadingDiv.style.display = "block";

  // fetch data
  const response = await getBlobFromUrlWithProgress(filePath, (progress) => {
    loadingDiv.innerHTML = `Đang tải dữ liêu... ${formatSize(
      progress.loaded
    )}/${formatSize(progress.total)} (${formatSize(progress.speed)}/s)`;
  });
  loadingDiv.innerHTML = "Tải xong. Đang giải nén dữ liệu...";
  const compressedData = new Uint8Array(await response.arrayBuffer());
  const content = pako.inflate(compressedData, { to: "string" });

  // prepare data
  loadingDiv.innerHTML = "Đang xử lý dữ liệu...";
  const lines = content.split("\n").filter(Boolean);
  const transactions = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",");
    transactions.push({
      date: parts[0],
      bank: parts[1],
      id: parts[2],
      money: Number(parts[3].replace(/\./g, "")),
      desc: parts[4],
      page: parts[5],
    });
  }
  console.log(transactions);

  // render table
  loadingDiv.innerHTML = "Đang tạo bảng...";
  if (gridApi) {
    gridApi.setGridOption("rowData", transactions);
  } else {
    gridApi = agGrid.createGrid(tableEle, {
      localeText: AG_GRID_LOCALE_VN,
      pagination: true,
      enableCellTextSelection: true,
      suppressDragLeaveHidesColumns: true,
      rowData: transactions,
      columnDefs: [
        {
          field: "date",
          headerName: "Ngày",
          width: 150,
          filter: "agDateColumnFilter",
          filterParams: {
            comparator: (filterLocalDateAtMidnight, cellValue) => {
              const dateAsString = cellValue;
              if (dateAsString == null) return -1;
              const dateParts = dateAsString.split(" ")[0].split("/");
              const cellDate = new Date(
                2024,
                Number(dateParts[1]) - 1,
                Number(dateParts[0])
              );
              if (filterLocalDateAtMidnight.getTime() === cellDate.getTime())
                return 0;
              if (cellDate < filterLocalDateAtMidnight) return -1;
              if (cellDate > filterLocalDateAtMidnight) return 1;
              return 0;
            },
            maxValidDate: "2024-09-13",
            minValidDate: "2024-09-01",
            inRangeFloatingFilterDateFormat: "Do MMM YYYY",
          },
        },
        {
          field: "bank",
          headerName: "Bank",
          width: 100,
        },
        {
          field: "id",
          headerName: "Mã",
          width: 130,
        },
        {
          field: "money",
          headerName: "Số tiền",
          valueFormatter: (params) => formatMoney(params.value),
          filter: "agNumberColumnFilter",
          type: ["rightAligned"],
          width: 150,
        },
        {
          field: "desc",
          headerName: "Nội dung chuyển khoản",
          wrapText: true,
          autoHeight: true,
          flex: 1,
        },
        {
          field: "page",
          headerName: "Trang",
          filter: "agNumberColumnFilter",
          width: 100,
        },
      ],
      defaultColDef: {
        filter: true,
        // sortable: true,
        // resizable: true,
        filterParams: {
          maxNumConditions: 10,
          defaultJoinOperator: "OR",
        },
        suppressMovable: true,
        floatingFilter: true,
      },

      onFilterChanged(params) {
        const data = [];
        params.api.forEachNodeAfterFilter((node) => {
          data.push(node.data);
        });
        drawSummary(data, transactions);
      },
    });
  }
  drawSummary(transactions, transactions);

  loadingDiv.style.display = "none";
}

function drawSummary(trans, allTrans) {
  // sumary
  loadingDiv.innerHTML = "Đang phân tích dữ liệu...";
  const total = trans.map((t) => t.money).reduce((a, b) => a + b, 0);
  const avg = total / trans.length;

  let max = 0,
    min = Infinity;
  trans.forEach((t) => {
    if (t.money > max) max = t.money;
    if (t.money < min) min = t.money;
  });

  sumaryTable.innerHTML =
    `<tr><th colspan='2' style="text-align: center">
      Thống kê
      ${trans.length < allTrans.length ? `dữ liệu đang hiển thị` : "TỔNG"}
    </th></tr>` +
    [
      ["Giao dịch", formatNumber(trans.length)],
      ["Tổng tiền", formatMoney(total)],
      ["Trung bình", formatMoney(avg)],
      ["Cao nhất", formatMoney(max)],
      ["Thấp nhất", formatMoney(min)],
    ]
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join("");

  // chart money range
  const ranges = [
    [1000, 10000],
    [10000, 20000],
    [20000, 50000],
    [50000, 100000],
    [100000, 200000],
    [200000, 500000],
    [500000, 1000000],
    [1000000, 5000000],
    [5000000, 10000000],
    [10000000, 50000000],
    [50000000, 100000000],
    [100000000, 500000000],
    [500000000, 1000000000],
  ];
  const totalByRange = ranges.map((range) => {
    const m = trans.filter((t) => t.money >= range[0] && t.money < range[1]);
    return {
      name: shortenMoney(range[0]) + " - " + shortenMoney(range[1]),
      moneys: m.reduce((a, b) => a + b.money, 0),
      transactions: m.length,
    };
  });

  if (!agChart) {
    agChartOptions = {
      container: document.getElementById("agChart"),
      theme: darkMode ? "ag-default-dark" : "ag-default",
      title: {
        text: "Tổng tiền/giao dịch theo giá tiền",
      },
      data: totalByRange,
      legend: {
        position: "top",
      },
      series: [
        {
          type: "bar",
          xKey: "name",
          yKey: "transactions",
          yName: "Tổng giao dịch",
          tooltip: {
            renderer: ({ datum, xKey, yKey }) => {
              return {
                title: datum[xKey],
                content: formatNumber(datum[yKey]),
              };
            },
          },
        },
        {
          type: "bar",
          xKey: "name",
          yKey: "moneys",
          yName: "Tổng tiền",
          tooltip: {
            renderer: ({ datum, xKey, yKey }) => {
              return {
                title: datum[xKey],
                content: formatMoney(datum[yKey]),
              };
            },
          },
        },
      ],
      axes: [
        {
          type: "category",
          position: "bottom",
          label: {
            autoRotate: false,
            rotation: 0,
            avoidCollisions: true,
          },
        },
        {
          type: "number",
          position: "left",
          keys: ["transactions"],
          label: {
            formatter: (params) => {
              return formatNumber(params.value);
            },
          },
        },
        {
          type: "number",
          position: "right",
          keys: ["moneys"],
          label: {
            formatter: (params) => {
              return shortenMoney(params.value);
            },
          },
        },
      ],
    };
    agChart = agCharts.AgCharts.create(agChartOptions);
  } else {
    agChartOptions.data = totalByRange;
    agCharts.AgCharts.update(agChart, agChartOptions);
  }
}

async function getBlobFromUrlWithProgress(url, progressCallback) {
  const response = await fetch(url, {});
  if (!response.ok) {
    throw new Error(`Error: ${response.status} - ${response.statusText}`);
  }
  const contentLength = response.headers.get("content-length");
  const total = parseInt(contentLength, 10);
  let loaded = 0;
  const reader = response.body.getReader();
  const chunks = [];

  const startTime = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    const ds = (Date.now() - startTime + 1) / 1000;
    progressCallback?.({
      loaded,
      total,
      speed: loaded / ds,
    });
    chunks.push(value);
  }

  const blob = new Blob(chunks, {
    type: response.headers.get("content-type"),
  });

  return blob;
}

// getBlobFromUrlWithProgress("../output/data.csv", (progress) => {
//   console.log((progress.loaded / progress.total) * 100);
// });

function formatSize(size, fixed = 0) {
  size = Number(size);
  if (!size) return "?";

  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return size.toFixed(fixed) + units[unitIndex];
}

function formatNumber(num) {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

function shortenMoney(money, fixed = 0) {
  money = Number(money);
  if (!money) return "?";

  const units = ["", "K", "M", "B"];
  let unitIndex = 0;
  while (money >= 1000 && unitIndex < units.length - 1) {
    money /= 1000;
    unitIndex++;
  }
  return money.toFixed(fixed) + units[unitIndex];
}

const formatter = {
  money: new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }),
};
function formatMoney(money) {
  return formatter.money.format(money);
}

function padZero(num) {
  return num.toString().padStart(2, "0");
}
