import { describe, expect, it } from "vitest";
import { redact } from "../../src/redaction";

const OTP = "[OTP ĐÃ CHE]";
const PASSWORD = "[MẬT KHẨU ĐÃ CHE]";
const CARD = "[SỐ THẺ ĐÃ CHE]";

describe("redact (SO-01-AC03)", () => {
  it("SO-01-AC03: masks a real OTP message and keeps the rest", () => {
    const r = redact("[Ví XYZ] Mã OTP của bạn là 483920, có hiệu lực trong 5 phút.");
    expect(r.text).toBe(`[Ví XYZ] Mã OTP của bạn là ${OTP}, có hiệu lực trong 5 phút.`);
    expect(r.counts).toEqual({ otp: 1, password: 0, card: 0 });
  });

  it("SO-01-AC03: matches keywords without diacritics and any case", () => {
    expect(redact("MA XAC THUC 12345678").text).toBe(`MA XAC THUC ${OTP}`);
    expect(redact("Your verification code: 4821").text).toBe(`Your verification code: ${OTP}`);
  });

  it("SO-01-AC03: masks a code written before the keyword", () => {
    expect(redact("482913 là mã OTP của bạn").text).toBe(`${OTP} là mã OTP của bạn`);
    expect(redact("482913 is your code").text).toBe(`${OTP} is your code`);
  });

  it("SO-01-AC03: keeps a 16-digit account number that passes Luhn when it follows STK", () => {
    const text = "Chuyển vào STK 4111111111111111 nhé";
    expect(redact(text)).toEqual({ text, counts: { otp: 0, password: 0, card: 0 } });
  });

  it("SO-01-AC03: keeps amounts such as 1.500.000đ, even near an OTP keyword", () => {
    const text = "Mã OTP để nhận 1.500.000đ hoặc 500000đ vào ngày 21/11/2026";
    expect(redact(text).text).toBe(text);
  });

  it("SO-01-AC03: masks a password in a Vietnamese sentence", () => {
    expect(redact("Mật khẩu của bạn là Abc@1234. Đăng nhập ngay").text).toBe(
      `Mật khẩu của bạn là ${PASSWORD}. Đăng nhập ngay`,
    );
    expect(redact("mk: banhbao").text).toBe(`mk: ${PASSWORD}`);
    expect(redact("mật khẩu banhbao").text).toBe(`mật khẩu ${PASSWORD}`);
    expect(redact("mã PIN 9731 nhé").text).toBe(`mã PIN ${PASSWORD} nhé`);
  });

  it.each([
    ["Mật khẩu ứng dụng là Abc2026x", `Mật khẩu ứng dụng là ${PASSWORD}`],
    [
      "Mật khẩu đăng nhập Internet Banking của bạn là Abc@2026x",
      `Mật khẩu đăng nhập Internet Banking của bạn là ${PASSWORD}`,
    ],
    ["Password for your wallet app: hunter2", `Password for your wallet app: ${PASSWORD}`],
    ["mk wifi nhà mình = banhbao nhé", `mk wifi nhà mình = ${PASSWORD} nhé`],
  ])("SO-01-AC03: masks what follows 'là', ':' or '=' later in the clause: %s", (text, out) => {
    expect(redact(text)).toEqual({ text: out, counts: { otp: 0, password: 1, card: 0 } });
  });

  it("SO-01-AC03: also masks a secret-looking word standing before that separator", () => {
    expect(redact("mk Abc123 là mới đổi").text).toBe(`mk ${PASSWORD} là ${PASSWORD} đổi`);
  });

  it("SO-01-AC03: still masks a lone word before 'là', which may be the password itself", () => {
    expect(redact("mk banhbao là xong").text).toBe(`mk ${PASSWORD} là ${PASSWORD}`);
  });

  it.each([
    "Mật khẩu: không chia sẻ cho ai",
    "Mật khẩu không được chia sẻ cho bất kỳ ai",
    "Mật khẩu là thứ riêng, đừng đưa ai. PIN: đừng gửi",
    "Mật khẩu: chưa đổi",
  ])("never removes a negation, which would flip the meaning: %s", (text) => {
    for (const word of text.match(/không|đừng gửi|chưa/g) ?? []) {
      expect(redact(text).text).toContain(word);
    }
  });

  it("SO-01-AC03: still masks secrets that merely look like a negation", () => {
    expect(redact("Mật khẩu: không123").text).toBe(`Mật khẩu: ${PASSWORD}`);
    expect(redact("Mật khẩu: Dung").text).toBe(`Mật khẩu: ${PASSWORD}`);
  });

  it("does not take 'lạ', a time or a link's colon for a separator", () => {
    expect(redact("Đổi mật khẩu, đăng nhập từ máy lạ abc").counts.password).toBe(0);
    expect(redact("Cung cấp mật khẩu để xem lúc 10:30 chiều").text).toContain("10:30 chiều");
    expect(redact("Mật khẩu hay mã OTP gửi qua máy lạ đều nguy hiểm").counts.password).toBe(0);
    expect(redact("Không chia sẻ mật khẩu cho ai, đây là quy định").counts.password).toBe(0);
    expect(redact("Nhập mật khẩu tại https://vi-xac-minh.example/a").text).toContain(
      "https://vi-xac-minh.example/a",
    );
  });

  it.each([
    ["mã PIN thẻ 9731", "9731"],
    ["pass wifi abc12345", "abc12345"],
    ["Mật khẩu của tôi 123456", "123456"],
    ["mật khẩu ví của mình Abc@x nhé", "Abc@x"],
    ["Mật khẩu tài khoản của tôi 123456", "123456"],
  ])("SO-01-AC03: masks a secret further along the clause: %s", (text, secret) => {
    const r = redact(text);
    expect(r.text).not.toContain(secret);
    expect(r.counts.password).toBeGreaterThanOrEqual(1);
  });

  it("Q-04: the wider password search leaves amounts, dates and the sender's data alone", () => {
    for (const kept of [
      "1.500.000đ",
      "500000 VND",
      "21/11/2026",
      "30-11-2026",
      "30.11.2026",
      "1900 1234",
      "STK 000123456789",
      "https://vi-xac-minh.example/a1b2",
    ]) {
      expect(redact(`Đổi mật khẩu để giữ ${kept}`).text, kept).toContain(kept);
    }
  });

  it.each([
    "Cung cấp mật khẩu và chuyển phí vào tài khoản 000987654321",
    "Gửi mật khẩu và phí vào TK 0009876543",
  ])("Q-04: keeps the account a scam asks to be paid into next to a password: %s", (text) => {
    expect(redact(text).text).toBe(text);
  });

  it("still labels a code near a password keyword as an OTP", () => {
    expect(redact("Nhập mật khẩu và mã OTP 482913").text).toBe(`Nhập mật khẩu và mã OTP ${OTP}`);
  });

  it("does not mask the ordinary word that follows a password keyword", () => {
    for (const text of [
      "Vui lòng cung cấp mật khẩu để huỷ giao dịch.",
      "Không bao giờ yêu cầu mật khẩu hay mã OTP qua điện thoại.",
      "nhập mật khẩu, sau đó xác nhận",
    ]) {
      expect(redact(text).text).toBe(text);
    }
  });

  it.each(["9704 1800 1234 5674", "9704-1900-1234-5673"])(
    "SO-01-AC03: masks a card whose middle groups look like a hotline: %s",
    (card) => {
      const r = redact(`Số thẻ của tôi ${card} nhé`);
      expect(r.text).toBe(`Số thẻ của tôi ${CARD} nhé`);
      expect(r.counts.card).toBe(1);
    },
  );

  it("Q-04: keeps a spaced receiving account after STK, even if the whole run passes Luhn", () => {
    const text = "Chuyển vào STK 411111 1111111111";
    expect(redact(text).text).toBe(text);
  });

  it("SO-01-AC03: masks card numbers that pass Luhn, with spaces or dashes, and CVV", () => {
    const r = redact("Thẻ 4111 1111 1111 1111 12/28, CVV: 123");
    expect(r.text).toBe(`Thẻ ${CARD} 12/28, CVV: ${CARD}`);
    expect(r.counts.card).toBe(2);
    expect(redact("so the 5555-5555-5555-4444").text).toBe(`so the ${CARD}`);
  });

  it("leaves a digit run that fails Luhn and a 6-digit run without a keyword", () => {
    const text = "Đơn 4111111111111112, tổng 482913";
    expect(redact(text).text).toBe(text);
  });

  it("SO-01-AC03: never masks URLs, phone numbers or receiving accounts (Q-04)", () => {
    const text =
      "Nhập mã OTP tại https://vi-xac-minh.example/id/123456 hoặc gọi 1900 0000, STK 000123456";
    expect(redact(text).text).toBe(text);
  });

  it("never masks digits inside a link that mentions an account (Q-04)", () => {
    const text = "Nhập mã OTP tại https://vi-xac-minh.example/account/12345678";
    expect(redact(text).text).toBe(text);
  });

  it("stays within the database limit for adversarial input", () => {
    const r = redact("pin:a1 ".repeat(285));
    expect([...r.text].length).toBeLessThanOrEqual(4000);
    expect(r.text).not.toContain("a1");
  });

  it.each([
    [
      "Mã OTP đăng nhập tài khoản của bạn là 482913",
      `Mã OTP đăng nhập tài khoản của bạn là ${OTP}`,
    ],
    [
      "Ma xac thuc giao dich tren tai khoan cua quy khach la 482913",
      `Ma xac thuc giao dich tren tai khoan cua quy khach la ${OTP}`,
    ],
    [
      "Tài khoản của bạn bị khoá, nhập số thẻ 4111111111111111",
      `Tài khoản của bạn bị khoá, nhập số thẻ ${CARD}`,
    ],
  ])("SO-01-AC03: 'tài khoản' before a secret does not protect it: %s", (text, expected) => {
    expect(redact(text).text).toBe(expected);
  });

  it("Q-04: still keeps a receiving account named in a message that also mentions a secret", () => {
    for (const text of [
      "Nhập mã OTP rồi chuyển vào tài khoản 000987654321",
      "Gửi mã OTP và phí vào STK: 00098765",
      "Đừng gửi mã OTP. Tài khoản nhận: 00098765",
    ]) {
      expect(redact(text).text).toBe(text);
    }
  });
});
