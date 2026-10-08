/**
 * UR E.25 测试清数端点开关（iOS 联调专用，prod 默认关）。
 * 开：`TEST_ENDPOINTS_ENABLED=1`（staging／preview／本地按需设）；
 * 关：变量未设即 404（iOS 视 404 为“端点未上线”toast，无崩无假成功）。
 */

/** 环境变量值→开关（`1`／`true` 开，其余全关，缺省关）。 */
export function isTestEndpointsEnabled(value: unknown): boolean {
  return value === "1" || value === "true";
}
