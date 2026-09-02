import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

// In-memory user fallback store when MongoDB is offline
const inMemoryUsers = new Map();

const generateTokensOffline = (user) => {
  const accessSecret =
    process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example";
  const refreshSecret =
    process.env.ACCESS_REFRESH_KEY ||
    "shoppy_refresh_token_secret_key_development_example";

  const accessToken = jwt.sign(
    {
      _id: user._id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
    accessSecret,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );

  const refreshToken = jwt.sign(
    {
      _id: user._id,
    },
    refreshSecret,
    { expiresIn: process.env.ACCESS_REFRESH_EXPIRY || "7d" }
  );

  return { accessToken, refreshToken };
};

export const registerUser = asyncHandler(async (req, res) => {
  const { name, fullName, email, password, username } = req.body;

  const displayName = fullName || name;
  if (!displayName || !displayName.trim()) {
    throw new ApiError(400, "Full name or name is required", [
      { field: "name", message: "Name is required" },
    ]);
  }

  if (!email || !email.trim()) {
    throw new ApiError(400, "Email is required", [
      { field: "email", message: "Email is required" },
    ]);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, "Please provide a valid email address", [
      { field: "email", message: "Invalid email format" },
    ]);
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long", [
      { field: "password", message: "Password must be at least 6 characters" },
    ]);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = (
    username ||
    normalizedEmail.split("@")[0] + Math.floor(100 + Math.random() * 900)
  )
    .trim()
    .toLowerCase();

  // If MongoDB is connected, use real Mongoose operations
  if (mongoose.connection.readyState === 1) {
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      throw new ApiError(409, "User with this email or username already exists", [
        { field: "email", message: "Account already exists with this email" },
      ]);
    }

    const user = await User.create({
      fullName: displayName.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      avatar: req.body.avatar || "",
      role: "CUSTOMER",
    });

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const safeUser = {
      id: user._id,
      _id: user._id,
      name: user.fullName,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };

    return res
      .status(201)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          201,
          {
            user: safeUser,
            accessToken,
            refreshToken,
            token: accessToken,
          },
          "User registered successfully"
        )
      );
  }

  // Offline / fallback mode
  if (inMemoryUsers.has(normalizedEmail)) {
    throw new ApiError(409, "User with this email already exists", [
      { field: "email", message: "Account already exists with this email" },
    ]);
  }

  const hashedPassword = await bcryptjs.hash(password, 10);
  const userId = `user_${Date.now()}`;
  const offlineUser = {
    _id: userId,
    id: userId,
    fullName: displayName.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    password: hashedPassword,
    avatar: req.body.avatar || "",
    role: "CUSTOMER",
  };

  const { accessToken, refreshToken } = generateTokensOffline(offlineUser);
  offlineUser.refreshToken = refreshToken;
  inMemoryUsers.set(normalizedEmail, offlineUser);

  const safeUser = {
    id: userId,
    _id: userId,
    name: offlineUser.fullName,
    fullName: offlineUser.fullName,
    username: offlineUser.username,
    email: offlineUser.email,
    role: offlineUser.role,
    avatar: offlineUser.avatar,
  };

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        201,
        {
          user: safeUser,
          accessToken,
          refreshToken,
          token: accessToken,
        },
        "User registered successfully"
      )
    );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    throw new ApiError(400, "Email/username and password are required", [
      { field: "credentials", message: "Please provide email and password" },
    ]);
  }

  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  if (mongoose.connection.readyState === 1) {
    const queryIdentifier = normalizedEmail
      ? { email: normalizedEmail }
      : { username: username.trim().toLowerCase() };

    const user = await User.findOne(queryIdentifier);

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    const safeUser = {
      id: user._id,
      _id: user._id,
      name: user.fullName,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          {
            user: safeUser,
            accessToken,
            refreshToken,
            token: accessToken,
          },
          "User logged in successfully"
        )
      );
  }

  // Offline / fallback mode
  const offlineUser = normalizedEmail ? inMemoryUsers.get(normalizedEmail) : null;
  if (!offlineUser) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcryptjs.compare(password, offlineUser.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = generateTokensOffline(offlineUser);
  offlineUser.refreshToken = refreshToken;

  const safeUser = {
    id: offlineUser._id,
    _id: offlineUser._id,
    name: offlineUser.fullName,
    fullName: offlineUser.fullName,
    username: offlineUser.username,
    email: offlineUser.email,
    role: offlineUser.role,
    avatar: offlineUser.avatar,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: safeUser,
          accessToken,
          refreshToken,
          token: accessToken,
        },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: 1,
        },
      },
      {
        new: true,
      }
    );
  }

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized: Refresh token is required");
  }

  let decodedToken;
  try {
    const refreshSecret =
      process.env.ACCESS_REFRESH_KEY ||
      "shoppy_refresh_token_secret_key_development_example";
    decodedToken = jwt.verify(incomingRefreshToken, refreshSecret);
  } catch (error) {
    throw new ApiError(401, "Unauthorized: Refresh token is invalid or expired");
  }

  if (mongoose.connection.readyState === 1) {
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token: User not found");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or has been revoked");
    }

    const newAccessToken = user.generateAccessToken();
    const newRefreshToken = user.generateRefreshToken();

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .cookie("accessToken", newAccessToken, cookieOptions)
      .cookie("refreshToken", newRefreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            token: newAccessToken,
          },
          "Access token refreshed successfully"
        )
      );
  }

  // Offline token refresh
  const accessSecret =
    process.env.ACCESS_TOKEN_KEY ||
    "shoppy_access_token_secret_key_development_example";

  const newAccessToken = jwt.sign(
    {
      _id: decodedToken._id,
      role: "CUSTOMER",
    },
    accessSecret,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );

  return res
    .status(200)
    .cookie("accessToken", newAccessToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          accessToken: newAccessToken,
          refreshToken: incomingRefreshToken,
          token: newAccessToken,
        },
        "Access token refreshed successfully"
      )
    );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const safeUser = {
    id: req.user._id,
    _id: req.user._id,
    name: req.user.fullName || req.user.name,
    fullName: req.user.fullName || req.user.name,
    username: req.user.username || "",
    email: req.user.email,
    role: req.user.role || "CUSTOMER",
    avatar: req.user.avatar || "",
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, safeUser, "Current user retrieved successfully")
    );
});
