import mongoose from "mongoose";
import { Address } from "../models/address.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Offline in-memory addresses fallback for test runs
const inMemoryAddresses = new Map();

export const getAddresses = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  if (mongoose.connection.readyState === 1) {
    const addresses = await Address.find({ user: req.user._id }).sort({
      isDefault: -1,
      createdAt: -1,
    });
    return res
      .status(200)
      .json(
        new ApiResponse(200, addresses, "Addresses retrieved successfully")
      );
  }

  // Offline fallback
  const userAddresses = inMemoryAddresses.get(userId) || [];
  return res
    .status(200)
    .json(
      new ApiResponse(200, userAddresses, "Addresses retrieved successfully")
    );
});

export const getAddressById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();

  if (!mongoose.Types.ObjectId.isValid(id) && !id.startsWith("addr_")) {
    throw new ApiError(400, "Invalid address ID format");
  }

  if (mongoose.connection.readyState === 1) {
    const address = await Address.findOne({ _id: id, user: req.user._id });
    if (!address) {
      throw new ApiError(404, "Address not found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, address, "Address retrieved successfully"));
  }

  // Offline fallback
  const userAddresses = inMemoryAddresses.get(userId) || [];
  const address = userAddresses.find((a) => a._id.toString() === id);
  if (!address) {
    throw new ApiError(404, "Address not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, address, "Address retrieved successfully"));
});

export const createAddress = asyncHandler(async (req, res) => {
  const {
    fullName,
    phone,
    streetAddress,
    city,
    state,
    postalCode: rawPostalCode,
    pinCode: rawPinCode,
    district,
    landmark,
    country,
    isDefault,
  } = req.body;
  const userId = req.user._id.toString();

  const postalCode = (rawPinCode || rawPostalCode || "").trim();
  const pinCode = postalCode;

  if (!fullName || !fullName.trim()) {
    throw new ApiError(400, "Full name is required");
  }
  if (!phone || !phone.trim()) {
    throw new ApiError(400, "Phone number is required");
  }
  if (!streetAddress || !streetAddress.trim()) {
    throw new ApiError(400, "Street address is required");
  }
  if (!city || !city.trim()) {
    throw new ApiError(400, "City is required");
  }
  if (!state || !state.trim()) {
    throw new ApiError(400, "State is required");
  }
  if (!postalCode) {
    throw new ApiError(400, "Postal code or PIN code is required");
  }

  if (mongoose.connection.readyState === 1) {
    const existingCount = await Address.countDocuments({ user: req.user._id });
    const shouldBeDefault = isDefault === true || existingCount === 0;

    const address = await Address.create({
      user: req.user._id,
      fullName: fullName.trim(),
      phone: phone.trim(),
      streetAddress: streetAddress.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode,
      pinCode,
      district: (district || "").trim(),
      landmark: (landmark || "").trim(),
      country: (country || "IN").trim(),
      isDefault: shouldBeDefault,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, address, "Address created successfully"));
  }

  // Offline fallback
  const userAddresses = inMemoryAddresses.get(userId) || [];
  const shouldBeDefault = isDefault === true || userAddresses.length === 0;

  if (shouldBeDefault) {
    userAddresses.forEach((a) => (a.isDefault = false));
  }

  const newAddress = {
    _id: `addr_${Date.now()}`,
    user: userId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    streetAddress: streetAddress.trim(),
    city: city.trim(),
    state: state.trim(),
    postalCode,
    pinCode,
    district: (district || "").trim(),
    landmark: (landmark || "").trim(),
    country: (country || "IN").trim(),
    isDefault: shouldBeDefault,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  userAddresses.push(newAddress);
  inMemoryAddresses.set(userId, userAddresses);

  return res
    .status(201)
    .json(new ApiResponse(201, newAddress, "Address created successfully"));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();
  const {
    fullName,
    phone,
    streetAddress,
    city,
    state,
    postalCode,
    pinCode,
    district,
    landmark,
    country,
    isDefault,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) && !id.startsWith("addr_")) {
    throw new ApiError(400, "Invalid address ID format");
  }

  if (mongoose.connection.readyState === 1) {
    const address = await Address.findOne({ _id: id, user: req.user._id });
    if (!address) {
      throw new ApiError(404, "Address not found");
    }

    if (fullName !== undefined) address.fullName = fullName.trim();
    if (phone !== undefined) address.phone = phone.trim();
    if (streetAddress !== undefined) address.streetAddress = streetAddress.trim();
    if (city !== undefined) address.city = city.trim();
    if (state !== undefined) address.state = state.trim();
    const effectiveCode = (pinCode || postalCode || "").trim();
    if (effectiveCode) {
      address.postalCode = effectiveCode;
      address.pinCode = effectiveCode;
    }
    if (district !== undefined) address.district = district.trim();
    if (landmark !== undefined) address.landmark = landmark.trim();
    if (country !== undefined) address.country = country.trim();
    if (isDefault !== undefined) address.isDefault = Boolean(isDefault);

    await address.save();
    return res
      .status(200)
      .json(new ApiResponse(200, address, "Address updated successfully"));
  }

  // Offline fallback
  const userAddresses = inMemoryAddresses.get(userId) || [];
  const addressIndex = userAddresses.findIndex((a) => a._id.toString() === id);
  if (addressIndex === -1) {
    throw new ApiError(404, "Address not found");
  }

  const addr = userAddresses[addressIndex];
  if (isDefault === true) {
    userAddresses.forEach((a) => (a.isDefault = false));
  }

  if (fullName !== undefined) addr.fullName = fullName.trim();
  if (phone !== undefined) addr.phone = phone.trim();
  if (streetAddress !== undefined) addr.streetAddress = streetAddress.trim();
  if (city !== undefined) addr.city = city.trim();
  if (state !== undefined) addr.state = state.trim();
  if (postalCode !== undefined) addr.postalCode = postalCode.trim();
  if (country !== undefined) addr.country = country.trim();
  if (isDefault !== undefined) addr.isDefault = Boolean(isDefault);
  addr.updatedAt = new Date();

  return res
    .status(200)
    .json(new ApiResponse(200, addr, "Address updated successfully"));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();

  if (!mongoose.Types.ObjectId.isValid(id) && !id.startsWith("addr_")) {
    throw new ApiError(400, "Invalid address ID format");
  }

  if (mongoose.connection.readyState === 1) {
    const address = await Address.findOneAndDelete({ _id: id, user: req.user._id });
    if (!address) {
      throw new ApiError(404, "Address not found or unauthorized");
    }

    // If deleted address was default, promote another address to default
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ user: req.user._id }).sort({
        createdAt: -1,
      });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Address deleted successfully"));
  }

  // Offline fallback
  const userAddresses = inMemoryAddresses.get(userId) || [];
  const addressIndex = userAddresses.findIndex((a) => a._id.toString() === id);
  if (addressIndex === -1) {
    throw new ApiError(404, "Address not found or unauthorized");
  }

  const [removed] = userAddresses.splice(addressIndex, 1);
  if (removed.isDefault && userAddresses.length > 0) {
    userAddresses[0].isDefault = true;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Address deleted successfully"));
});
