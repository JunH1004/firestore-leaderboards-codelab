//로직 방식이 바뀌면 버전이 바뀐다.
/*
firestore에 workoutLog을 불러와서 운동 점수를 계산해야하지만 매번 그러는 것은 함수 처리 시간이 길어짐..
해결방법 : 
    1 운동 점수 계산에 사용된 workoutLog에 점수 필드와 버전 필드를 추가한다.
    2 버전 변경이 없다면 점수를 다시 계산하지 않고 그대로 읽어서 사용.
    3 버전 변경이 있다면 점수를 다시 계산한다.
    읽을때 마다 점수 계산 함수 돌리기 vs 한번만 DB에 쓰기, 후자가 더 효율적

*/

"use strict";

const pullup_tier_logic_version = 1; //20240717

/**
 * Computes the tier score based on workout sets, negative ratio, and tempo.
 * @param {Array<number>} sets Array of integers representing sets for each workout.
 * @param {number} negativeRatio Negative ratio value (between 0.4 and 0.7).
 * @param {Array<number>} tempo Array of integers representing tempo for each workout.
 * @return {number} The computed tier score.
 */
function computePullupTierScore(sets, negativeRatio, tempo) {
  const adjustedNegativeRatio = Math.max(0.4, Math.min(0.7, negativeRatio));

  let result = 0;
  sets.forEach(set => {
    let ts = 0;
    let combo = 0;
    for (let i = 0; i < set; i++) {
      combo += 1;
      ts += combo + 1;
    }
    result += ts;
  });

  let correctPacePoint = 0;
  const tempoMean = getTempoMean(tempo);
  if (tempoMean >= 36 && tempoMean <= 44) {
    correctPacePoint = result * 0.2;
  }

  let consistentPacePoint = 0;
  const tempoStandardDeviation = getTempoStandardDeviation(tempo);
  consistentPacePoint = Math.max(result * (0.2 - tempoStandardDeviation * 0.2), 0);

  let negativeRatioPoint = result * ((adjustedNegativeRatio - 0.4) * (2 / 3));

  consistentPacePoint *= 1.5;
  consistentPacePoint *= 0.5;
  result += correctPacePoint + consistentPacePoint + negativeRatioPoint;

  return Math.round(result);
}

/**
 * Calculates the mean (average) of an array of numbers.
 * @param {Array<number>} tempo Array of integers representing tempo for each workout.
 * @return {number} The mean of the array.
 */
function getTempoMean(tempo) {
  const sum = tempo.reduce((acc, val) => acc + val, 0);
  return sum / tempo.length;
}

/**
 * Calculates the standard deviation of an array of numbers.
 * @param {Array<number>} tempo Array of integers representing tempo for each workout.
 * @return {number} The standard deviation of the array.
 */
function getTempoStandardDeviation(tempo) {
  const mean = getTempoMean(tempo);
  const variance = tempo.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / tempo.length;
  return Math.sqrt(variance) * 0.1;
}

module.exports = { computePullupTierScore };
