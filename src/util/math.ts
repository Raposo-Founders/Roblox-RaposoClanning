export function UTIL_MATH_ConvertCFrameToVector3(input: CFrame) {
  const [rY, rX, rZ] = input.ToOrientation();

  return {
    position: input.Position,
    rotation: new Vector3(math.deg(rX), math.deg(rY), math.deg(rZ))
  };
}

export function UTIL_MATH_ConvertVector3ToCFrame(position: Vector3, rotation: Vector3) {
  return new CFrame(position).mul(CFrame.Angles(math.rad(rotation.Y), math.rad(rotation.X), math.rad(rotation.Z)));
}