const data = {
  sales_owner_infos: [
    {
      currency_ids: [1, 2],
    },
    {
      currency_ids: [3, 4],
    },
  ],
};
console.log(
  "data = ",
  data.sales_owner_infos?.some((c) => c.currency_ids.includes(2)),
);
