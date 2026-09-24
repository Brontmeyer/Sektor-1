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

    if (result?.action === "purchase") {
      const quantity = Math.max(1, Number(result.quantity) || 1);
      const record = $gameParty.merchandiseRecord(result.type, result.id);
      const purchase = $gameParty.purchaseMerchandise(result.type, result.id, quantity);

      if (purchase.success) {
        this.shopWindow.setMessage(
          `Purchased ${record?.name || "merchandise"}${quantity > 1 ? ` x${quantity}` : ""} for ${purchase.totalPrice} Runes.`,
        );
        return;
      }

      if (purchase.reason === "insufficientGil") {
        this.shopWindow.setMessage(
          `Not enough Runes. Need ${purchase.requiredGil}, have ${purchase.gil}.`,
        );
        return;
      }

      this.shopWindow.setMessage("That purchase could not be completed.");
      return;
    }

    if (result?.action === "sell") {
      const quantity = Math.max(1, Number(result.quantity) || 1);
      const record = $gameParty.merchandiseRecord(result.type, result.id);
      const sale = $gameParty.sellMerchandise(result.type, result.id, quantity);

      if (sale.success) {
        this.shopWindow.setMessage(
          `Sold ${record?.name || "merchandise"}${quantity > 1 ? ` x${quantity}` : ""} for ${sale.totalPrice} Runes.`,
        );
        return;
      }

      if (sale.reason === "insufficientInventory") {
        this.shopWindow.setMessage(
          `Cannot sell ${record?.name || "that item"}. Available ${sale.available ?? sale.owned}, requested ${sale.requested}.`,
        );
        return;
      }

      if (sale.reason === "unsellable") {
        this.shopWindow.setMessage(`${record?.name || "That item"} cannot be sold.`);
        return;
      }

      this.shopWindow.setMessage("That sale could not be completed.");
      return;
    }
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
