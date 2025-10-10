import TrackingLog from "../models/TrackingLog.js";
import UserOrder from "../models/UserOrder.js";
import Ornament from "../models/Ornament.js";

export const getAnalyticsSummary = async (req, res) => {
  try {
    const { range = "30" } = req.query; // default 30 days
    const days = parseInt(range, 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Unique visitors
    const uniqueVisitors = await TrackingLog.distinct("sessionId", {
      event: "visit",
      timestamp: { $gte: startDate },
    });

    // Cart adds
    const cartAdds = await TrackingLog.countDocuments({
      event: "add_to_cart",
      timestamp: { $gte: startDate },
    });

    // Purchases
    const purchases = await TrackingLog.countDocuments({
      event: "purchase",
      timestamp: { $gte: startDate },
    });

    // Conversion rate
    const conversionRate =
      cartAdds > 0 ? ((purchases / cartAdds) * 100).toFixed(2) : "0.00";

    // Top products (resolve product names)
    const topProductsRaw = await TrackingLog.aggregate([
      { $match: { event: "add_to_cart", timestamp: { $gte: startDate } } },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const topProducts = await Ornament.find({
      _id: { $in: topProductsRaw.map((p) => p._id) },
    }).select("name");

    const topProductsMapped = topProductsRaw.map((p) => {
      const prod = topProducts.find((o) => o._id.toString() === p._id.toString());
      return { _id: prod?.name || "Unknown", count: p.count };
    });

    // Average order value (AOV)
    const orders = await UserOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "Paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $isNumber: "$totalAmount" },
                "$totalAmount",
                "$totalAmount.amount",
              ],
            },
          },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const avgOrderValue =
      orders.length > 0
        ? (orders[0].totalRevenue / orders[0].totalOrders).toFixed(2)
        : "0.00";

    // 📊 Daily Stats (visits & purchases grouped by day)
    const dailyStatsRaw = await TrackingLog.aggregate([
      { $match: { timestamp: { $gte: startDate }, event: { $in: ["visit", "purchase"] } } },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$timestamp" },
            month: { $month: "$timestamp" },
            year: { $year: "$timestamp" },
            event: "$event",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { day: "$_id.day", month: "$_id.month", year: "$_id.year" },
          stats: { $push: { event: "$_id.event", count: "$count" } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Transform to { date, visits, purchases }
    const dailyStats = dailyStatsRaw.map((d) => {
      const dateKey = `${d._id.year}-${String(d._id.month).padStart(2, "0")}-${String(
        d._id.day
      ).padStart(2, "0")}`;
      const visits = d.stats.find((s) => s.event === "visit")?.count || 0;
      const purchases = d.stats.find((s) => s.event === "purchase")?.count || 0;
      return { date: dateKey, visits, purchases };
    });

    res.json({
      success: true,
      summary: {
        visitors: uniqueVisitors.length,
        cartAdds,
        purchases,
        conversionRate,
        avgOrderValue,
        topProducts: topProductsMapped,
        dailyStats, // ✅ now included for line chart
        range: `${days} days`,
      },
    });
  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).json({
      success: false,
      message: "Analytics fetch failed",
      error: err.message,
    });
  }
};
