/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount = 0, sale_price, quantity } = purchase;
  const discountFactor = 1 - discount / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) {
    return profit * 0.15;
  } else if (index === 1 || index === 2) {
    return profit * 0.1;
  } else if (index === total - 1) {
    return 0;
  } else {
    return profit * 0.05;
  }
}

/**
 * Главная функция анализа данных
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  if (!data) throw new Error("Нет входных данных");
  if (!Array.isArray(data.sellers) || data.sellers.length === 0)
    throw new Error("Нет массива sellers или он пустой");
  if (!Array.isArray(data.products) || data.products.length === 0)
    throw new Error("Нет массива products или он пустой");
  if (
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  )
    throw new Error("Нет массива purchase_records или он пустой");

  const { calculateRevenue, calculateBonus } = options || {};
  if (
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  )
    throw new Error("Не переданы функции для расчётов");

  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    products_sold: {},
    sales_count: 0,
    _totalRevenue: 0,
    _totalProfit: 0,
  }));

  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.sales_count += 1;

    // Сразу берём revenue из total_amount
    const revenue = record.total_amount || 0;
    seller._totalRevenue += revenue;

    // profit считаем на уровне каждого товара
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      const cost = product ? product.purchase_price * item.quantity : 0;
      const itemRevenue =
        item.sale_price * item.quantity * (1 - (item.discount || 0) / 100);
      const profit = itemRevenue - cost;
      seller._totalProfit += profit;

      seller.products_sold[item.sku] =
        (seller.products_sold[item.sku] || 0) + item.quantity;
    });
  });

  // Сортировка по прибыли
  sellerStats.sort((a, b) => b._totalProfit - a._totalProfit);

  // Назначение бонусов
  sellerStats.forEach((seller, index) => {
    const bonus = calculateBonus(index, sellerStats.length, {
      seller_id: seller.id,
      name: seller.name,
      revenue: seller._totalRevenue,
      profit: seller._totalProfit,
      sales_count: seller.sales_count,
    });
    seller._bonus = bonus;
  });

  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller._totalRevenue.toFixed(2),
    profit: +seller._totalProfit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10),
    bonus: +seller._bonus.toFixed(2),
  }));
}
