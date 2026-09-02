import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.header("Authorization")?.replace("Bearer ", "") ||
    req.cookies?.accessToken ||
    req.header("x-auth-token");

  if (!token) {
    throw new ApiError(401, "Unauthorized: Authentication token is missing");
  }

  let decodedToken;
  try {
    const secret =
      process.env.ACCESS_TOKEN_KEY ||
      "shoppy_access_token_secret_key_development_example";
    decodedToken = jwt.verify(token, secret);
  } catch (error) {
    throw new ApiError(401, "Unauthorized: Access token is invalid or expired");
  }

  const user = await User.findById(decodedToken?._id).select("-password");

  if (!user) {
    throw new ApiError(401, "Invalid access token: User not found");
  }

  req.user = user;
  next();
});

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized: Authentication required"));
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Forbidden: Insufficient privileges. Required role(s): ${allowedRoles.join(", ")}`
        )
      );
    }

    next();
  };
};
