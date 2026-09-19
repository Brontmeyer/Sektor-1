"use strict";

class Scene_Shop extends Scene_Base {
  constructor(shopData = {}) {
    super();

    this.shopData = {
      name: shopData.name || "Shop",
      goods: Array.isArray(shopData.goods) ? shopData.goods : [],
    };
    this.shopWindow = new Window_Shop(this.shopData);
  }

  update() {
    this.shopWindow.update();

    if (!this.shopWindow.hasResult()) {
      return;
    }

    const result = this.shopWindow.takeResult();

    if (result?.action === "cancel") {
      SceneManager.pop();
      return;
    }

    if (result?.action !== "purchase") {
      return;
    }

    const record = $gameParty.merchandiseRecord(result.type, result.id);
    const purchase = $gameParty.purchaseMerchandise(result.type, result.id, 1);

    if (purchase.success) {
      this.shopWindow.setMessage(
        `Purchased ${record?.name || "merchandise"} for ${purchase.totalPrice} Gil.`,
      );
      return;
    }

    if (purchase.reason === "insufficientGil") {
      this.shopWindow.setMessage(
        `Not enough Gil. Need ${purchase.requiredGil}, have ${purchase.gil}.`,
      );
      return;
    }

    this.shopWindow.setMessage("That purchase could not be completed.");
  }

  draw() {
    const context = Graphics.context;

    context.save();
    context.fillStyle = "#202020";
    context.fillRect(0, 0, Graphics.width, Graphics.height);
    context.restore();

    this.shopWindow.draw();
  }
}
