export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function add(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function roundNutrition(n: Nutrition): Nutrition {
  return {
    kcal: round1(n.kcal),
    protein: round1(n.protein),
    carbs: round1(n.carbs),
    fat: round1(n.fat),
  };
}
