/**
 * PolylineDashAA —— 抗锯齿虚线材质
 *
 * ## 为什么要自研这个材质
 * `Cesium.PolylineDashMaterialProperty`（材质 `PolylineDash`）在片元着色器里
 * 用 `fract` + `floor` 对 16 位掩码做**硬二值化**：
 * ```glsl
 * float dashPosition = fract(pos.x / (dashLength * czm_pixelRatio));
 * float maskIndex = floor(dashPosition * maskLength);
 * float maskTest = floor(dashPattern / pow(2.0, maskIndex));
 * vec4 fragColor = (mod(maskTest, 2.0) < 1.0) ? gapColor : color;   // 二选一，无过渡
 * ```
 * 于是虚线端面是**硬边**，在斜向/细线上呈现明显锯齿。
 *
 * 关键点：**该锯齿无法靠 MSAA 解决** —— MSAA 只在三角形边缘做覆盖率解析，
 * 而虚线端面位于折线四边形**内部**（同一三角形内的片元着色器颜色突变）。
 * 因此必须在着色器内做解析式抗锯齿。
 *
 * 对照：Cesium 自己的三个折线材质中，`PolylineGlowMaterial` 用连续衰减（天然平滑）、
 * `PolylineOutlineMaterial` 调用了 `czm_antialias`（已抗锯齿），
 * **唯独 `PolylineDashMaterial` 没有** —— 本材质即补齐这一处。
 *
 * ## 实现
 * 用屏幕空间导数 `fwidth` 求出一个像素跨越多少掩码单元，再以半个像素为间隔做
 * 3 点箱式滤波，得到该像素的实线覆盖率，最后按覆盖率混合实线色与间隙色。
 *
 * 导数可用性守卫与 Cesium 官方写法保持一致（`__VERSION__ == 300` 覆盖 WebGL2，
 * 此时 `GL_OES_standard_derivatives` 宏不会定义）；WebGL1 由 Cesium 的
 * `demodernizeShader` 自动补 `#extension GL_OES_standard_derivatives : enable`。
 */

uniform vec4 color;
uniform vec4 gapColor;
uniform float dashLength;
uniform float dashPattern;

in float v_polylineAngle;

const float maskLength = 16.0;

mat2 rotate(float rad) {
    float c = cos(rad);
    float s = sin(rad);
    return mat2(
        c, s,
        -s, c
    );
}

/**
 * 取掩码坐标处的「实线覆盖率」
 * 与 Cesium 原实现一致：把 dashPattern 当作 16 位掩码逐单元判定
 * @param maskPos 掩码坐标（0 ~ maskLength）
 * @return 1.0 = 实线，0.0 = 空隙
 */
float dashMask(float maskPos) {
    float index = clamp(floor(maskPos), 0.0, maskLength - 1.0);
    float test = floor(dashPattern / pow(2.0, index));
    return mod(test, 2.0) < 1.0 ? 0.0 : 1.0;
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);

    vec2 pos = rotate(v_polylineAngle) * gl_FragCoord.xy;

    // 掩码坐标：一个 dash 周期映射到 maskLength 个掩码单元
    float maskPos = fract(pos.x / (dashLength * czm_pixelRatio)) * maskLength;

#if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))
    // 一个屏幕像素跨越多少个掩码单元
    float footprint = fwidth(maskPos);
#else
    // 无导数信息（极老环境）：退化为固定半单元采样，仍可平滑端面
    float footprint = 1.0;
#endif

    // 以「半个像素」为间隔做 3 点箱式滤波得到实线覆盖率。
    // 下限 0.5 保证即使无导数信息也有一次端面平滑；
    // 上限 2.0 避免虚线周期远小于像素时（亚像素图案）出现摩尔纹。
    float tap = clamp(footprint * 0.5, 0.5, 2.0);
    float coverage = (dashMask(maskPos - tap)
                    + dashMask(maskPos)
                    + dashMask(maskPos + tap)) / 3.0;

    // 以「较不透明的一侧」作为可见色。
    // Cesium 使用**非预乘 alpha** 混合；若直接 mix(gapColor, color, coverage)，
    // 默认的透明间隙（gapColor.a == 0）会把实线 RGB 一并稀释，
    // 使抗锯齿过渡带整体发暗（细线尤其明显）。
    bool colorIsVisible = color.a >= gapColor.a;
    vec4 solidColor = colorIsVisible ? color : gapColor;
    vec4 otherColor = colorIsVisible ? gapColor : color;
    float solidCoverage = colorIsVisible ? coverage : (1.0 - coverage);

    vec4 fragColor;
    if (otherColor.a > 0.0) {
        // 两侧都可见（双色虚线）：按覆盖率线性混合
        fragColor = mix(otherColor, solidColor, solidCoverage);
    } else {
        // 间隙透明：仅按覆盖率缩放 alpha，保持实线 RGB 不被稀释
        fragColor = vec4(solidColor.rgb, solidColor.a * solidCoverage);
    }

    if (fragColor.a < 0.005) {   // matches 0/255 and 1/255
        discard;
    }

    fragColor = czm_gammaCorrect(fragColor);
    material.emission = fragColor.rgb;
    material.alpha = fragColor.a;
    return material;
}
