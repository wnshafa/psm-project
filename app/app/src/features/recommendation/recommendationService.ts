export function getSkincareRecommendations(
  skinType: string,
  acneLevel: string
) {
  const categories: string[] = [];

  if (acneLevel === 'high') {
    categories.push('acne treatment');
  }

  if (skinType === 'dry') {
    categories.push('moisturizer');
  } else if (skinType === 'oily') {
    categories.push('oil control');
  }

  return {
    categories,
    message: `Based on your skin condition, these are recommended products.`
  };
}