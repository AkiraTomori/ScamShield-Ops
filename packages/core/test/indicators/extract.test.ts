import { BRANDS } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { extractIndicators } from "../../src/indicators";

const pick = (text: string, type: string) =>
  extractIndicators(text, BRANDS)
    .indicators.filter((i) => i.type === type)
    .map((i) => i.normalized);

describe("URLs and domains (SO-02-AC01)", () => {
  it("SO-02-AC01: extracts a bare .example domain as a url plus its registrable domain", () => {
    const found = extractIndicators("Xác minh tại vi-xac-minh.example.", BRANDS).indicators;
    expect(found).toEqual([
      {
        type: "url",
        value: "vi-xac-minh.example",
        normalized: "http://vi-xac-minh.example/",
        checks: [],
      },
      {
        type: "domain",
        value: "vi-xac-minh.example",
        normalized: "vi-xac-minh.example",
        checks: [],
      },
    ]);
  });

  it("SO-07-AC02: normalises case, www, subdomains and punycode", () => {
    expect(pick("HTTPS://WWW.Vi-Xac-Minh.Example/a?b=1", "domain")).toEqual([
      "vi-xac-minh.example",
    ]);
    expect(pick("a.b.vi-xac-minh.example", "domain")).toEqual(["vi-xac-minh.example"]);
    expect(pick("x.vietcombank.com.vn/dang-nhap", "domain")).toEqual(["vietcombank.com.vn"]);
    expect(pick("http://ví-điện.example", "domain")[0]).toMatch(/^xn--.*\.example$/);
  });

  it("SO-02-AC01: undoes common disguises but shows the text as written", () => {
    for (const text of [
      "hxxp://vi-xac-minh[.]example/x",
      "vi-xac-minh(.)example",
      "vi-xac-minh{.}example",
      "vi-xac-minh dot example",
    ]) {
      const found = extractIndicators(`Vào ${text} ngay`, BRANDS).indicators;
      expect(found.find((i) => i.type === "domain")?.normalized).toBe("vi-xac-minh.example");
      expect(found.find((i) => i.type === "url")?.value).toBe(text);
    }
  });

  it.each([
    ["Bit.ly/3xyz", "bit.ly"],
    ["T.co/x", "t.co"],
    ["Is.gd/x", "is.gd"],
    ["Bit.Ly/3xyz", "bit.ly"],
  ])("SO-02-AC02: a capitalised short link with a path is still a link: %s", (link, domain) => {
    const found = extractIndicators(`${link} nhận quà`, BRANDS).indicators;
    expect(found.find((i) => i.type === "url")?.value).toBe(link);
    expect(found.find((i) => i.type === "domain")?.normalized).toBe(domain);
  });

  it.each([
    ["vi-xac-minh[.]example", "vi-xac-minh[.]example"],
    ["hxxp://a.b.Vi-Xac-Minh(.)example/x", "Vi-Xac-Minh(.)example"],
    ["vi-xac-minh dot example", "vi-xac-minh dot example"],
    ["http://vietcombank.com.vn@evil.example/a", "evil.example"],
    ["https://www.vi-xac-minh.example.:8080/a", "vi-xac-minh.example"],
  ])("shows the domain exactly as written in %s", (text, shown) => {
    const found = extractIndicators(`Vào ${text} ngay`, BRANDS).indicators;
    const domain = found.find((i) => i.type === "domain");
    expect(domain?.value).toBe(shown);
    expect(text).toContain(domain?.value);
  });

  it("keeps an IP host as a url with no domain indicator", () => {
    const found = extractIndicators("http://203.0.113.7/login", BRANDS);
    expect(found.indicators.map((i) => i.type)).toEqual(["url"]);
    expect(found.urls[0]?.isIp).toBe(true);
  });

  it("SO-02-AC02: reads a bare IPv4 that has a path or port", () => {
    for (const text of ["vào 203.0.113.7/login ngay", "203.0.113.7:8080"]) {
      expect(extractIndicators(text, BRANDS).urls[0]?.isIp).toBe(true);
    }
  });

  it("ignores a bare dotted number without a path or port", () => {
    for (const text of ["địa chỉ 1.2.3.4 nhé", "bản v1.2.3.4/a", "mục 21.11/abc"]) {
      expect(pick(text, "url")).toEqual([]);
    }
  });

  it("takes the real host when a brand domain is written as userinfo", () => {
    expect(pick("http://vietcombank.com.vn@evil.example/a", "domain")).toEqual(["evil.example"]);
  });

  it.each([
    "Chi nhánh TP.HCM",
    "giấy tờ, v.v. và hơn nữa",
    "số tiền 1.500.000đ",
    "gọi 0901.234.567",
    "PGS.TS Nguyễn Văn A, ThS.BS Trần B",
    "Cảm ơn.Vui lòng chờ",
    "học tại TP.HCM/Hà Nội, ThS.BS/ PGS",
    "mail ho.tro@vietcombank.com.vn",
  ])("does not treat %s as a domain", (text) => {
    expect(pick(text, "domain")).toEqual([]);
    expect(pick(text, "url")).toEqual([]);
  });
});

describe("phones, accounts and brands", () => {
  it("SO-07-AC02: normalises Vietnamese phone numbers", () => {
    expect(pick("0901 234 567 hoặc +84 912-345-678", "phone")).toEqual([
      "+84901234567",
      "+84912345678",
    ]);
    expect(pick("bàn 024 3123 4567", "phone")).toEqual(["+842431234567"]);
    expect(pick("hotline 1900 1234", "phone")).toEqual(["19001234"]);
  });

  it("does not read an amount or a longer number as a phone", () => {
    expect(pick("19000000đ và mã 70901234567890", "phone")).toEqual([]);
  });

  it("SO-02-AC01: extracts account numbers only after a keyword", () => {
    expect(pick("STK 000123456789 ngân hàng", "bank_account")).toEqual(["000123456789"]);
    expect(pick("số tài khoản mới của công ty: 000987654321, nhé", "bank_account")).toEqual([
      "000987654321",
    ]);
    expect(pick("chuyen khoan vao 0011.0042.3456", "bank_account")).toEqual(["001100423456"]);
    expect(pick("STK 000123456789 24 giờ", "bank_account")).toEqual(["000123456789"]);
    expect(pick("mã đơn 000123456789", "bank_account")).toEqual([]);
  });

  it("does not read an amount after 'tài khoản' as an account", () => {
    expect(pick("tài khoản của bạn bị trừ 2.000.000đ", "bank_account")).toEqual([]);
    expect(pick("tài khoản được cộng 5000000 VND", "bank_account")).toEqual([]);
    expect(pick("TK 0001***789 +2.000.000đ", "bank_account")).toEqual([]);
  });

  it.each([
    ["Tài khoản của bạn bị khoá, gọi ngay 0901234567", "+84901234567"],
    ["Tài khoản bị khoá, liên hệ tổng đài 19001234", "19001234"],
    ["TK có vấn đề, gọi +84 901 234 567", "+84901234567"],
  ])("SO-02-AC01: a phone after a bare 'tài khoản' is not also an account: %s", (text, phone) => {
    expect(pick(text, "phone")).toEqual([phone]);
    expect(pick(text, "bank_account")).toEqual([]);
  });

  it("keeps a phone-shaped number as an account after STK or 'số tài khoản'", () => {
    for (const text of [
      "STK 0901234567",
      "số tài khoản: 0901234567",
      "STK MB 0901234567",
      "chuyển tiền vào 0901234567",
    ]) {
      expect(pick(text, "bank_account")).toEqual(["0901234567"]);
    }
  });

  it.each([
    "xem https://x.example/account/12345678",
    "xem https://x.example/a?acc=12345678",
    "xem x.example/tk/123456789",
    "xem hxxp://x[.]example/stk/123456789",
  ])("SO-02-AC01: a number inside a link is not a bank account: %s", (text) => {
    expect(pick(text, "bank_account")).toEqual([]);
    expect(pick(text, "url")).toHaveLength(1);
  });

  it("still reads an account written next to a link", () => {
    expect(pick("vào x.example/a rồi chuyển vào STK 000123456789", "bank_account")).toEqual([
      "000123456789",
    ]);
  });

  it("SO-02-AC04: finds an account in a message without any link", () => {
    const found = extractIndicators("Chuyển gấp vào STK 000123456789", BRANDS);
    expect(found.urls).toEqual([]);
    expect(found.indicators.map((i) => i.type)).toEqual(["bank_account"]);
  });

  it("matches long aliases ignoring case and diacritics, short ones only in capitals", () => {
    expect(pick("VIETCOMBANK và zalo pay", "brand")).toEqual(["vietcombank", "zalopay"]);
    expect(pick("MB và ACB thông báo", "brand")).toEqual(["mb", "acb"]);
    expect(pick("mb, acb, 5MB dữ liệu", "brand")).toEqual([]);
  });

  it("SO-02-AC01: same content gives the same list in order of appearance", () => {
    const text = "MoMo: gọi 0901234567, vào momo-uudai.example, STK 000123456789";
    const first = extractIndicators(text, BRANDS);
    expect(first.indicators.map((i) => i.type)).toEqual([
      "brand",
      "phone",
      "url",
      "domain",
      "bank_account",
    ]);
    expect(extractIndicators(text, BRANDS)).toEqual(first);
  });

  it("caps each kind at 10", () => {
    const text = Array.from({ length: 14 }, (_, i) => `a${i}.example`).join(" ");
    expect(pick(text, "url")).toHaveLength(10);
  });
});
