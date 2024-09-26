// WARNING: require node version >= 18

import fs from "fs";
import zlib from "zlib";
import { PdfDataParser } from "pdf-data-parser";

/*
Transaction format:
{
  date: string,
  bank: string,
  id: string,
  money: number,
  desc: string,
  page: number,
}
*/

async function main() {
  const allTrans = [
    ...(await MTTQ_VCB_1_10()),
    ...(await MTTQ_VCB_11()),
    ...(await MTTQ_VCB_12()),
    ...(await MTTQ_VCB_13()),
    ...(await MTTQ_VCB_14()),
    ...(await MTTQ_BIDV_1_12()),
    ...(await MTTQ_BIDV_10_17()),
    ...(await MTTQ_BIDV_18_19()),
    ...(await MTTQ_Agribank_9_13()),
    ...(await CTTU_Vietinbank_10_12()),
    ...(await CTTU_Vietinbank_13_15()),
    ...(await CTTU_Vietinbank_16()),
    ...(await CTTU_Vietinbank_17()),
  ]
    // sort by date
    .sort((a, b) => a.date.localeCompare(b.date))
    // shorten date
    .map(cleanData);

  // Save all
  const outputPath = "./data/output/";
  saveTransactions(allTrans, outputPath + "all");

  // Load all
  // console.log('Loading "all" transactions...');
  // const allTransCsv = fs.readFileSync(outputPath + "all.csv").toString("utf-8");
  // const allTrans = allTransCsv
  //   .split("\n")
  //   .slice(1) // remove header
  //   .map((_) => {
  //     const [date, bank, id, money, desc, page] = _.split(",");
  //     return {
  //       date,
  //       bank,
  //       id,
  //       money: parseInt(money),
  //       desc,
  //       page: parseInt(page) || "_",
  //     };
  //   });

  // Save by date
  console.log("Saving " + allTrans.length + " transactions by date...");
  const dates = [...new Set(allTrans.map((_) => _.date.trim().split(" ")[0]))];
  console.log(dates);
  for (const date of dates) {
    const trans = allTrans.filter((_) => _.date.startsWith(date));
    saveTransactions(trans, outputPath + "byDate/" + date.replace(/\//g, "-"));
  }

  // Save by bank
  console.log("Saving " + allTrans.length + " transactions by bank...");
  const banks = [...new Set(allTrans.map((_) => _.bank))];
  for (const bank of banks) {
    const trans = allTrans.filter((_) => _.bank === bank);
    saveTransactions(trans, outputPath + "byBank/" + bank);
  }

  // Save top money
  const topLength = 5000;
  const topMoney = [...allTrans]
    .sort((a, b) => b.money - a.money)
    .slice(0, topLength);
  console.log("Saving " + topMoney.length + " top money transactions...");
  saveTransactions(topMoney, outputPath + "top/topMoney");
}
main();

async function MTTQ_VCB_1_10(
  pdfPath = "./data/input/MTTQ_VCB_1-10.pdf",
  outputPath = "./data/output/byFile/MTTQ_VCB_1-10"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions...");
  const transactions = [];
  let i = 0;
  let page = 1;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*
      [
        "09/09/2024 5243.90051",
        "1.000.000",
        "MBVCB.6986253876.Zoey ung ho khac phuc"
      ] */
    const [_, date, transId] =
      rows[i]?.[0]?.match(/^([0-3][0-9]\/09\/2024) (.[\d\.]*)$/) || [];
    const [money] = rows[i]?.[1]?.match(/^(\d{1,3}(?:\.\d{3})*)$/) || [];

    if (date && transId && money) {
      const descs = rows[i].slice(2);
      while (true) {
        if (!rows[i + 1] || rows[i + 1].length !== 1) break;
        descs.push(rows[i + 1][0]);
        i++;
      }
      transactions.push({
        date,
        bank: "VCB",
        id: transId,
        money: moneyToInt(money),
        desc: descs
          .filter(Boolean)
          .map((_) => _.replace(/,/g, " ").trim())
          .join(" "),
        page,
      });
    }

    if (rows[i]?.length === 1) {
      // "Page 190 of 12028"
      const [_, curPage, totalPage] =
        rows[i][0].match(/Page (\d+) of (\d+)$/) || [];
      if (curPage && totalPage) {
        page = parseInt(curPage) + 1;
      }
    }

    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function MTTQ_VCB_11(
  pdfPath = "./data/input/MTTQ_VCB_11.pdf",
  outputPath = "./data/output/byFile/MTTQ_VCB_11"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions..." + rows.length);
  const transactions = [];
  let i = 0;

  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;

    /*[
        "1",
        "11/09/2024",
        "20.000",
        "nen khong co nhieu tien hom nay chau danh ra 1 bua an sang cua chau de ung"
    ],
    [
        "ho cho ba con vung lu a cua it long nhieu mong mn thong cam\""
    ],
    [
        "13",
        "11/09/2024",
        "100.000 \"980389.100924.232504.LE VI GIA HAN chuyen FT24255151179173\""
    ],*/
    const [index] = rows[i]?.[0]?.match(/^(\d+)$/) || [];
    const [date] = rows[i]?.[1]?.match(/^1[1-9]\/09\/2024$/) || [];
    const [_, money, __, desc] =
      rows[i]?.[2]?.match(/(\d{1,3}(?:\.\d{3})*)(\s*(?:"(.*)(")?)?)/) || [];

    if (date && index && money) {
      if (!desc && !rows[i][3]) console.log(rows[i]);
      const descs = [desc, rows[i][3]];
      while (rows[i + 1]?.length === 1) {
        descs.push(rows[i + 1][0]);
        i++;
      }
      transactions.push({
        id: index,
        bank: "VCB",
        date,
        money: moneyToInt(money),
        desc: descs
          .filter(Boolean)
          .map(
            (_) =>
              _.replace(/,/g, " ")
                .trim()
                .replace(/^\"(.*)\"$/, "$1") // "abc" => abc
          )
          .join(" "),
        page: "_",
      });
    }
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function MTTQ_VCB_12(
  pdfPath = "./data/input/MTTQ_VCB_12.pdf",
  outputPath = "./data/output/byFile/MTTQ_VCB_12"
) {
  // Cùng cấu trúc
  return MTTQ_VCB_11(pdfPath, outputPath);
}

async function MTTQ_VCB_13(
  pdfPath = "./data/input/MTTQ_VCB_13.pdf",
  outputPath = "./data/output/byFile/MTTQ_VCB_13"
) {
  // Cùng cấu trúc
  return MTTQ_VCB_11(pdfPath, outputPath);
}

async function MTTQ_VCB_14(
  pdfPath = "./data/input/MTTQ_VCB_14.pdf",
  outputPath = "./data/output/byFile/MTTQ_VCB_14"
) {
  // Cùng cấu trúc
  return MTTQ_VCB_11(pdfPath, outputPath);
}

async function MTTQ_BIDV_1_12(
  pdfPath = "./data/input/MTTQ_BIDV_1-12.pdf",
  outputPath = "./data/output/byFile/MTTQ_BIDV_1-12"
) {
  const rows = await getPDF(pdfPath, outputPath);

  // clean data
  for (let i = 0; i < rows.length; i++) {
    if (
      rows[i]?.[0]?.startsWith(
        "Chứng từ này được in/chuyển đổi trực tiếp từ hệ thống"
      )
    ) {
      if (
        rows[i - 1]?.length < 4 &&
        rows[i - 1].length + rows[i + 1].length === 4
      ) {
        rows[i - 1] = rows[i - 1].concat(rows[i + 1]);
        rows[i + 1] = [];
      }
      if (rows[i][1] && rows[i][1] !== "351") {
        rows[i - 1].push(rows[i][1]);
      }
      rows[i] = [];
    }

    if (rows[i]?.length === 1 && rows[i][0] === "351") {
      rows[i] = [];
    }
  }

  // backup special case
  rows.push([
    "3115",
    "10/09/2024 22:49:38",
    "50.000",
    "1261122666 Chuyen tien",
  ]);

  console.log("Parsing transactions..." + rows.length);
  const transactions = [];
  let i = 0;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*[
      "672",
      "10/09/2024 01:03:56",
      "200.000",
      "1261122666 NGUYEN THI HUYEN TRANG Chuyen tien; thoi gian GD:09092024 23:55:31"
    ]*/
    const [index] = rows[i]?.[0]?.match(/^(\d+)$/) || [];
    const [date] =
      rows[i]?.[1]?.match(/^[0-1][0-9]\/09\/2024 (\d{2}:\d{2}:\d{2})$/) || [];
    const money = rows[i]?.[2]?.match(/(\d{1,3}(?:\.\d{3})*)$/)?.[0] || 0;

    if (date && index && money) {
      const descs = [rows[i][3] || rows[i][2]];
      if (descs.length > 0 || money) {
        transactions.push({
          date,
          bank: "BIDV",
          id: index,
          money: moneyToInt(money),
          desc: descs
            .filter(Boolean)
            .map((_) => _.replace(/,/g, " ").trim())
            .join(" "),
          page: "_",
        });
      } //else console.log(rows[i], date, index, money);
    } //else rows[i]?.length && console.log(rows[i], date, index, money);
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function MTTQ_BIDV_10_17(
  pdfPath = "./data/input/MTTQ_BIDV_10-17.pdf",
  outputPath = "./data/output/byFile/MTTQ_BIDV_10-17"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions..." + rows.length);
  const transactions = [];
  let i = 0;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*[
      "17",
      "10/09/2024 0:55:10",
      "0091000639xxx",
      "400.000,00",
      "TKThe :0091000639xxx, tai VCB. MBVCB.6988293532.235166.cam nhung ung ho ba con lu lut.CT tu 0091000639xxx TRAN THI CAM NHUNG toi 1261122666 UBTW MTTQ VIET NAM tai BIDV -CTLNHIDI000009811425241-1/1-CRE-002; thoi gian GD:09/09/2024 23:"
    ]
    [
      '10119',
      '16/09/2024 9:27:00',
      '2.000.000,00',
      '185 BINH LONG NGUOI GUI NGUYEN THANH NHAN CUU TRO LU LUT'
    ]
    [
      "10685",
      "17/09/2024 23:12:53",
      "7500539xxx",
      "200.000,001261122666 ung ho mien Bac"
    ] */
    const [index] = rows[i]?.[0]?.match(/^(\d+)$/) || [];
    const [date] =
      rows[i]?.[1]?.match(/^[0-1][0-9]\/09\/2024 (\d{1,}:\d{1,}:\d{1,})$/) ||
      [];
    const money =
      [2, 3]
        .map(
          (j) =>
            rows[i]?.[j]?.split(",")?.[0].match(/(\d{1,3}(?:\.\d{3})*)$/)?.[0]
        )
        .find((_) => _) || 0;
    const moneyAt2 = rows[i]?.[2]?.startsWith?.(money);
    const descAt3 = rows[i]?.[3]?.startsWith?.(money)
      ? rows[i][3].split(",00")[1]
      : "";

    if (date && index && money) {
      const descs = moneyAt2
        ? [descAt3, ...rows[i].slice(3)]
        : [descAt3, rows[i][2], ...rows[i].slice(4)];
      if (descs.length > 0 || money) {
        transactions.push({
          date,
          bank: "BIDV",
          id: index,
          money: moneyToInt(money),
          desc: descs
            .filter(Boolean)
            .map((_) => _.replace(/,/g, " ").trim())
            .join(" "),
          page: "_",
        });
      } //else console.log(rows[i], date, index, money);
    } //else rows[i]?.length && console.log(rows[i], date, index, money);
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function MTTQ_BIDV_18_19(
  pdfPath = "./data/input/MTTQ_BIDV_18-19.pdf",
  outputPath = "./data/output/byFile/MTTQ_BIDV_18-19"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions..." + rows.length);
  const transactions = [];
  let i = 0;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*[
        "11019/9/2024 9:24:52",
        "5002567686xxx",
        "200.000,00",
        "TKThe :5002567686xxx, tai Agribank. BIDV;1261122666; vk ck Chiec Luan xin gui chut tam long nho den voi ba con mien Bac mong cho binh an va nhungdieu yeu thuong den voi toan the ba con Viet - CTLNHIDI000009908356542-1/1-CRE-002"
    ]*/
    const [_, index, date] =
      rows[i]?.[0]?.match(/^(\d+)(1[0-9]\/9\/2024) (\d{1,}:\d{1,}:\d{1,})$/) ||
      [];
    const money =
      [1, 2]
        .map(
          (j) =>
            rows[i]?.[j]?.split(",")?.[0].match(/(\d{1,3}(?:\.\d{3})*)$/)?.[0]
        )
        .find((_) => _) || 0;
    const moneyAt1 = rows[i]?.[1]?.startsWith?.(money);

    if (date && index && money) {
      const descs = moneyAt1
        ? rows[i].slice(2)
        : [rows[i][1], ...rows[i].slice(3)];
      if (descs.length > 0 || money) {
        transactions.push({
          date: date?.replace("/9/", "/09/"),
          bank: "BIDV",
          id: index,
          money: moneyToInt(money),
          desc: descs
            .filter(Boolean)
            .map((_) => _.replace(/,/g, " ").trim())
            .join(" "),
          page: "_",
        });
      } //else console.log(rows[i], date, index, money);
    } //else rows[i]?.length && console.log(rows[i], date, index, money);
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function MTTQ_Agribank_9_13(
  pdfPath = "./data/input/MTTQ_Agribank_9-13.pdf",
  outputPath = "./data/output/byFile/MTTQ_Agribank_9-13"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions..." + rows.length);
  const transactions = [];
  let i = 0;
  let page = 1;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;

    /*[
        "Website: www.agribank.com.vn.",
        "1237/1706",
        "Người in: HNTBHA Thời gian in: 13/09/2024 16:15:56"
    ] */
    if (rows[i][0] === "Website: www.agribank.com.vn.") {
      const [_, curPage, totalPage] = rows[i][1].match(/(\d+)\/(\d+)/) || [];
      if (curPage && totalPage) {
        page = parseInt(curPage) + 1;
      }
    }

    /*[
        "10/09/2024",
        "NGUYEN THI HONG DUYEN ung",
        "50,000",
        "574,700 2882370"
    ],
    [
        "ho cac tinh bi bao lu"
    ],*/
    const [date] = rows[i]?.[0]?.match(/^[0-1][0-9]\/09\/2024$/) || [];
    const money = rows[i]?.[2]?.match(/(\d{1,3}(?:,\d{3})*)$/)?.[0] || 0;
    const [_, sodu, id] =
      rows[i]?.[3]?.match(/(\d{1,3}(?:,\d{3})*) (\d+)$/) || [];

    if (date && id && money) {
      const descs = [rows[i][1]];
      while (rows[i + 1]?.length === 1) {
        descs.push(rows[i + 1][0]);
        i++;
      }
      transactions.push({
        id,
        bank: "Agri",
        date,
        money: moneyToInt(money),
        desc: descs
          .filter(Boolean)
          .map((_) => _.replace(/,/g, " ").trim())
          .join(" "),
        page: page,
      });
    }
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function CTTU_Vietinbank_10_12(
  pdfPath = "./data/input/CTTU_Vietinbank_10-12.pdf",
  outputPath = "./data/output/byFile/CTTU_Vietinbank_10-12"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions...");
  const transactions = [];
  let i = 0;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*
      [
        "110/09/2024 12:01:29",
        "CT nhanh 247 den: TRAN TIEN ANH chuyen tien ung ho nguoi dan vung bao lu",
        "300.000",
        "TRAN TIEN ANH – A/C"
    ] */
    const [_, index, date, time] =
      rows[i]?.[0]?.match(/^(\d+)(1[0-5]\/09\/2024) (\d{2}:\d{2}:\d{2})$/) ||
      [];
    const [money] = rows[i]?.[2]?.match(/^(\d{1,3}(?:\.\d{3})*)$/) || [];

    if (date && index && time && money) {
      const descs = [rows[i][1], ...rows[i].slice(3)];
      transactions.push({
        date: `${date} ${time}`,
        bank: "Vietin",
        id: index,
        money: moneyToInt(money),
        desc: descs
          .filter(Boolean)
          .map((_) => _.replace(/,/g, " ").trim())
          .join(" "),
        page: "_",
      });
    } //else console.log(rows[i], date, index, time, money);
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function CTTU_Vietinbank_13_15(
  pdfPath = "./data/input/CTTU_Vietinbank_13-15.pdf",
  outputPath = "./data/output/byFile/CTTU_Vietinbank_13-15"
) {
  // Cùng cấu trúc
  return CTTU_Vietinbank_10_12(pdfPath, outputPath);
}

async function CTTU_Vietinbank_16(
  pdfPath = "./data/input/CTTU_Vietinbank_16.pdf",
  outputPath = "./data/output/byFile/CTTU_Vietinbank_16"
) {
  const rows = await getPDF(pdfPath, outputPath);

  console.log("Parsing transactions...");
  const transactions = [];
  let i = 0;
  while (i < rows.length) {
    if (!Array.isArray(rows[i])) continue;
    /*
      [
        "9",
        "16/09/2024 00:57:49",
        "con mong moi nguoi binh an (CT1111); thoi gian GD:15/09/2024 23:09:00",
        "100.000",
        "MAI THI ANH NGOC",
        "109882673***"
    ]
    [
        "3812",
        "16/09/2024 10:59:26",
        "Chuyen tien den tu NAPAS Noi dung: IBFT gop chut tam long cung ba con vung lu (ct1111)",
        "060129014***300.000",
        "SACOMBANK"
    ] */
    const index = rows[i]?.[0]?.match(/\d+$/)?.[0];
    const [_, date, time] =
      rows[i]?.[1]?.match(/^(1[67]\/09\/2024) (\d{2}:\d{2}:\d{2})$/) || [];
    const money = rows[i]?.[3]?.match(/(\d{1,3}(?:\.\d{3})*)/)?.[0];
    const descInMoney = !money || money.length < rows[i]?.[3].length;

    if (date && index && time) {
      const descs = [
        descInMoney ? null : rows[i]?.[2],
        ...rows[i].slice(descInMoney ? 2 : 4),
      ]
        .filter(Boolean)
        .map((_) => (descInMoney ? _.replace(money, "") : _));
      // if (!moneyToInt(money)) console.log(rows[i]);
      transactions.push({
        date: `${date} ${time}`,
        bank: "Vietin",
        id: index,
        money: moneyToInt(money),
        desc: descs
          .filter(Boolean)
          .map((_) => _.replace(/,/g, " ").trim())
          .join(" "),
        page: "_",
      });
    } //else console.log(rows[i], date, index, time, money);
    i++;
  }

  // save transactions
  saveTransactions(transactions, outputPath);

  return transactions;
}

async function CTTU_Vietinbank_17(
  pdfPath = "./data/input/CTTU_Vietinbank_17.pdf",
  outputPath = "./data/output/byFile/CTTU_Vietinbank_17"
) {
  // Cùng cấu trúc
  return CTTU_Vietinbank_16(pdfPath, outputPath);
}

async function getPDF(pdfPath, outputPath) {
  const cacheFile = outputPath + "_cache.json";

  try {
    console.log("Loading cached file..." + cacheFile);
    const rows = JSON.parse(fs.readFileSync(cacheFile).toString("utf-8"));
    if (rows.length) return rows;
  } catch (e) {
    console.log("No cached file: " + e);
  }

  console.log("Loading PDF file... " + pdfPath);
  const parser = new PdfDataParser({ url: pdfPath });

  console.log("Parsing PDF...");
  const rows = await parser.parse();

  console.log("Saving result to cache file..." + cacheFile);
  fs.writeFileSync(cacheFile, JSON.stringify(rows, null, 4));

  return rows;
}

function moneyToInt(money) {
  if (!money) return 0;
  return parseInt(money.replace(/[.,]/g, ""));
}

function saveTransactions(data, outputPath) {
  if (!data?.length) return console.log("> ERROR: No transactions to save");

  // fs.writeFileSync(outputPath + ".json", JSON.stringify(data, null, 4));
  // console.log("Saved " + data.length + " transactions to " + outputPath + ".json");

  const _data = data.map(cleanData);

  const csvFile = outputPath + ".csv";
  const csv = _data
    .map(
      (t) =>
        `${t.date},${t.bank},${t.id},${t.money},${t.desc.replace(/,/g, " ")},${
          t.page
        }`
    )
    .join("\n");
  fs.writeFileSync(csvFile, "date,bank,id,money,desc,page\n" + csv);
  console.log("Saved " + _data.length + " transactions to " + csvFile);

  // Compress
  console.log("Compressing...");
  const compressedFile = csvFile + ".gz";
  const input = fs.createReadStream(csvFile);
  const output = fs.createWriteStream(compressedFile);
  input.pipe(zlib.createGzip({ level: 9, memLevel: 9 })).pipe(output);
  output.on("finish", () => {
    console.log("Saved compressed CSV to " + compressedFile);
  });
}

function log(msg) {
  process.stdout.write(msg + "\r");
}

function cleanData(_) {
  return {
    ..._,
    desc: _.desc
      .trim()
      .replace(/\s+/g, " ") // "  " => " "
      .replace(/^\"(.*)\"$/, "$1"), // "abc" => abc
    // 01/09/2024 -> 1/9
    date: _.date
      // .replace(/0(\d\/)/g, "$1")
      .replace("/2024", ""),
  };
}
