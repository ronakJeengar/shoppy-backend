import mongoose from "mongoose";
import { Conversation, memoryConversations } from "../models/conversation.model.js";
import { defaultAiService } from "../ai/services/aiService.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Primary conversational chat endpoint: POST /api/v1/ai/chat
 * Integrates multi-turn conversation persistence, tool execution, and structured UI components.
 */
export const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, conversationId, options = {} } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    throw new ApiError(400, "Message parameter is required and must be a non-empty string");
  }

  const userId = req.user?._id ? req.user._id.toString() : null;
  let conversation = null;
  let convId = conversationId;

  // 1. Retrieve or initialize conversation
  if (mongoose.connection.readyState === 1) {
    if (convId && mongoose.Types.ObjectId.isValid(convId)) {
      conversation = await Conversation.findById(convId);
      // IDOR check: if conversation has an owner and authenticated user differs
      if (conversation && conversation.user && userId && conversation.user.toString() !== userId) {
        throw new ApiError(403, "Unauthorized access to this conversation");
      }
    }

    if (!conversation) {
      conversation = new Conversation({
        user: req.user?._id || null,
        title: message.trim().substring(0, 40) || "Shopping Assistant Chat",
        messages: [],
      });
      await conversation.save();
      convId = conversation._id.toString();
    }
  } else {
    // In-memory fallback
    if (convId && memoryConversations.has(convId)) {
      conversation = memoryConversations.get(convId);
      if (conversation && conversation.user && userId && conversation.user.toString() !== userId) {
        throw new ApiError(403, "Unauthorized access to this conversation");
      }
    }

    if (!conversation) {
      convId = convId || `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      conversation = {
        _id: convId,
        id: convId,
        user: userId,
        title: message.trim().substring(0, 40) || "Shopping Assistant Chat",
        status: "ACTIVE",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryConversations.set(convId, conversation);
    }
  }

  // 2. Format recent history for context continuity (last 6 messages)
  const history = (conversation.messages || [])
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));

  // 3. Process chat through AI orchestrator
  const aiResult = await defaultAiService.processRequest({
    message: message.trim(),
    user: req.user || null,
    history,
    options: { ...options, conversationId: convId },
  });

  // 4. Append user and assistant messages
  const userMsg = {
    id: `msg_u_${Date.now()}`,
    role: "user",
    content: message.trim(),
    timestamp: new Date(),
  };

  const assistantMsg = {
    id: `msg_a_${Date.now()}`,
    role: "assistant",
    content: aiResult.message || aiResult.answer,
    products: aiResult.products || [],
    sources: aiResult.sources || [],
    actions: aiResult.actions || [],
    toolResults: aiResult.toolResults || [],
    timestamp: new Date(),
  };

  if (mongoose.connection.readyState === 1) {
    conversation.messages.push(userMsg);
    conversation.messages.push(assistantMsg);
    conversation.metadata = {
      ...conversation.metadata,
      lastActivityAt: new Date(),
    };
    await conversation.save();
  } else {
    conversation.messages.push(userMsg);
    conversation.messages.push(assistantMsg);
    conversation.updatedAt = new Date();
    memoryConversations.set(convId, conversation);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        conversationId: convId,
        message: assistantMsg.content,
        answer: assistantMsg.content,
        products: assistantMsg.products,
        sources: assistantMsg.sources,
        actions: assistantMsg.actions,
        requestId: aiResult.requestId,
        metadata: aiResult.metadata,
      },
      "Assistant response generated successfully"
    )
  );
});

/**
 * Retrieve paginated conversations for authenticated user: GET /api/v1/ai/conversations
 */
export const getConversations = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    throw new ApiError(401, "Authentication required to view conversations");
  }

  const userId = req.user._id.toString();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  if (mongoose.connection.readyState === 1) {
    const filter = { user: req.user._id, status: "ACTIVE" };
    const total = await Conversation.countDocuments(filter);
    const conversations = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("_id title status updatedAt createdAt messages")
      .lean();

    const formatted = conversations.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      status: c.status,
      messageCount: c.messages?.length || 0,
      lastMessage: c.messages?.length > 0 ? c.messages[c.messages.length - 1].content : "",
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversations: formatted,
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
        "Conversations retrieved successfully"
      )
    );
  } else {
    // In-memory fallback
    const userConvs = Array.from(memoryConversations.values()).filter(
      (c) => c.user === userId && c.status !== "ARCHIVED"
    );

    userConvs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const paginated = userConvs.slice(skip, skip + limit);

    const formatted = paginated.map((c) => ({
      id: (c._id || c.id).toString(),
      title: c.title,
      status: c.status,
      messageCount: c.messages?.length || 0,
      lastMessage: c.messages?.length > 0 ? c.messages[c.messages.length - 1].content : "",
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          conversations: formatted,
          page,
          limit,
          total: userConvs.length,
          totalPages: Math.ceil(userConvs.length / limit) || 1,
        },
        "Conversations retrieved successfully"
      )
    );
  }
});

/**
 * Retrieve full message history of a specific conversation: GET /api/v1/ai/conversations/:id
 */
export const getConversationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id ? req.user._id.toString() : null;
  const isAdmin = req.user?.role === "ADMIN";

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid conversation ID format");
    }

    const conversation = await Conversation.findById(id).lean();
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user.toString() !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: conversation._id.toString(),
          title: conversation.title,
          status: conversation.status,
          messages: conversation.messages,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        "Conversation retrieved successfully"
      )
    );
  } else {
    // In-memory fallback
    const conversation = memoryConversations.get(id);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          id: (conversation._id || conversation.id).toString(),
          title: conversation.title,
          status: conversation.status,
          messages: conversation.messages,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        "Conversation retrieved successfully"
      )
    );
  }
});

/**
 * Archive or delete a conversation: DELETE /api/v1/ai/conversations/:id
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id ? req.user._id.toString() : null;
  const isAdmin = req.user?.role === "ADMIN";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid conversation ID format");
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user.toString() !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    conversation.status = "ARCHIVED";
    await conversation.save();

    return res.status(200).json(
      new ApiResponse(200, { id: conversation._id }, "Conversation deleted successfully")
    );
  } else {
    // In-memory fallback
    const conversation = memoryConversations.get(id);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    conversation.status = "ARCHIVED";
    memoryConversations.set(id, conversation);

    return res.status(200).json(
      new ApiResponse(200, { id }, "Conversation deleted successfully")
    );
  }
});

/**
 * Clear all messages in a conversation: POST /api/v1/ai/conversations/:id/clear
 */
export const clearConversationMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id ? req.user._id.toString() : null;
  const isAdmin = req.user?.role === "ADMIN";

  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }

  if (mongoose.connection.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid conversation ID format");
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user.toString() !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    conversation.messages = [];
    await conversation.save();

    return res.status(200).json(
      new ApiResponse(200, { id: conversation._id }, "Conversation messages cleared successfully")
    );
  } else {
    const conversation = memoryConversations.get(id);
    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    if (conversation.user && !isAdmin && conversation.user !== userId) {
      throw new ApiError(403, "Unauthorized access to this conversation");
    }

    conversation.messages = [];
    conversation.updatedAt = new Date();
    memoryConversations.set(id, conversation);

    return res.status(200).json(
      new ApiResponse(200, { id }, "Conversation messages cleared successfully")
    );
  }
});
