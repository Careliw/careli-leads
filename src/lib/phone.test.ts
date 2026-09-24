import { describe, expect, it } from "vitest";
import { normalizePhoneDigits, toWhatsAppPhone } from "@/lib/phone";

describe("normalizePhoneDigits", () => {
  it("remove espaços, parênteses e traços, e assume DDI 55 quando ausente", () => {
    expect(normalizePhoneDigits("(11) 98888-1001")).toBe("5511988881001");
  });

  it("mantém o DDI quando já presente (não duplica o 55)", () => {
    expect(normalizePhoneDigits("+55 11 98888-1001")).toBe("5511988881001");
  });

  it("mantém apenas dígitos mesmo com letras misturadas", () => {
    expect(normalizePhoneDigits("tel: 11988881001 (whats)")).toBe("5511988881001");
  });

  it("duas grafias do mesmo telefone (com e sem DDI) normalizam para o mesmo valor", () => {
    const comDdi = normalizePhoneDigits("+55 (11) 98888-1001");
    const semDdi = normalizePhoneDigits("11988881001");
    expect(comDdi).toBe(semDdi);
    expect(comDdi).toBe("5511988881001");
  });

  it("string vazia quando não há dígitos", () => {
    expect(normalizePhoneDigits("sem número")).toBe("");
  });
});

describe("toWhatsAppPhone", () => {
  it("adiciona o DDI 55 quando ausente", () => {
    expect(toWhatsAppPhone("11988881001")).toBe("5511988881001");
  });

  it("não duplica o DDI quando já presente", () => {
    expect(toWhatsAppPhone("+55 11 98888-1001")).toBe("5511988881001");
  });
});
