import assert from "node:assert/strict";
import test from "node:test";
import { parseWhatsApp } from "../api/extension/lib/normalizers.js";
import { parseWhatsAppContact } from "../chrome-extension/lib/whatsapp-parser.js";

const parsers = [
  ["servidor", parseWhatsApp],
  ["extensão", parseWhatsAppContact],
];

for (const [label, parser] of parsers) {
  test(`${label}: normaliza números brasileiros`, () => {
    assert.equal(parser("+55 73 99999-9999")?.number, "5573999999999");
    assert.equal(parser("(73) 99999-9999")?.number, "5573999999999");
    assert.equal(parser("5573999999999")?.number, "5573999999999");
  });

  test(`${label}: preserva número internacional`, () => {
    assert.equal(parser("+1 (415) 555-2671")?.number, "14155552671");
  });

  test(`${label}: extrai wa.me e remove mensagem`, () => {
    const parsed = parser(
      "https://wa.me/5573999999999?text=Ol%C3%A1&app_absent=0",
    );
    assert.deepEqual(parsed, {
      number: "5573999999999",
      url: "https://wa.me/5573999999999",
    });
  });

  test(`${label}: extrai API, Web e protocolo WhatsApp`, () => {
    const urls = [
      "https://api.whatsapp.com/send?phone=5573999999999&text=Quero%20informações",
      "https://web.whatsapp.com/send?phone=5573999999999&text=Olá",
      "whatsapp://send?phone=5573999999999&text=Olá",
    ];
    for (const url of urls) {
      assert.equal(parser(url)?.number, "5573999999999");
    }
  });

  test(`${label}: aceita URL codificada`, () => {
    const encoded = encodeURIComponent(
      "https://api.whatsapp.com/send?phone=5573999999999&text=Olá",
    );
    assert.equal(parser(encoded)?.number, "5573999999999");
  });

  test(`${label}: rejeita número e texto inválidos`, () => {
    assert.equal(parser("123"), null);
    assert.equal(parser("fale conosco"), null);
    assert.equal(parser("https://example.com/5573999999999"), null);
  });
}
