import assert from "node:assert/strict";
import test from "node:test";
import { parseInstagram } from "../api/extension/lib/normalizers.js";
import { parseInstagramProfile } from "../chrome-extension/lib/instagram-parser.js";

const parsers = [
  ["servidor", parseInstagram],
  ["extensão", parseInstagramProfile],
];

for (const [label, parser] of parsers) {
  test(`${label}: normaliza URL de perfil`, () => {
    assert.deepEqual(parser("https://www.instagram.com/alineestetica"), {
      username: "alineestetica",
      displayUsername: "@alineestetica",
      url: "https://www.instagram.com/alineestetica/",
    });
  });

  test(`${label}: aceita barra, parâmetros e letras maiúsculas`, () => {
    assert.equal(
      parser("https://www.instagram.com/Aline.Estetica/?igsh=abc#bio")?.username,
      "aline.estetica",
    );
  });

  test(`${label}: rejeita rotas internas`, () => {
    for (const path of ["p/post", "reel/video", "direct/inbox", "explore"]) {
      assert.equal(parser(`https://www.instagram.com/${path}/`), null);
    }
  });

  test(`${label}: rejeita URL inválida e domínio diferente`, () => {
    assert.equal(parser("https://instagram.com/"), null);
    assert.equal(parser("https://example.com/alineestetica/"), null);
    assert.equal(parser("https://www.instagram.com/aline/extra/"), null);
  });
}
