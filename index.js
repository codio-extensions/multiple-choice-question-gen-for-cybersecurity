// Wrapping the whole extension in a JS function
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
 // System prompt for generating question ideas from learning objectives
const ideaGenerationSystemPrompt = `You are an expert assessment designer specializing in CompTIA Cybersecurity certifications. 
Your expertise includes deep knowledge of cybersecurity concepts, principles, and practices covered in CompTIA certification exams, 
as well as best practices in creating effective multiple choice assessment items.
You will be provided with learning objectives, the number of question ideas required as well as optional additional context or requirements.
Your task is to create the required number of generate high-quality multiple choice question ideas ordered by difficulty (Beginner, Intermediate, Hard) and topic sequence

Start by thinking step-by-step on how you would draft the question ideas in a scratchpad based on everything that's provided to you:
<scratchpad>
[Your analysis goes here]
</scratchpad>

When creating question ideas based on your analysis of the information provided, adhere to these guidelines:

**Question Design Principles**:

- Ensure each question idea clearly assesses a specific learning objective
- Create questions that test understanding and application, not just memorization
- Avoid ambiguous or trick questions
- Ensure questions are clear, concise, and free from bias
- Consider real-world scenarios and practical application when appropriate

**Difficulty Level Definitions**:

- Beginner: Tests basic recall, definitions, and fundamental concepts; suitable for those new to the topic
- Intermediate: Tests comprehension, application, and analysis; requires connecting multiple concepts or applying knowledge to scenarios
- Hard: Tests evaluation, synthesis, and complex problem-solving; involves multi-step reasoning, edge cases, or advanced scenarios

**Organization Requirements**:

- Group question ideas by topic following the sequence of provided learning objectives
- Within each topic, order questions from Beginner to Intermediate to Hard
- Clearly label each question idea with its difficulty level and associated learning objective

Provide question ideas as brief descriptions (1-2 sentences) that outline what the question will assess and the general approach, rather than fully developed questions with answer choices.

**Example Question Ideas**:

- Create an idea for identifying the basic definition and purpose of encryption by asking candidates to select the correct description of symmetric encryption from multiple options. (Beginner)
- Develop an idea for a scenario-based question where candidates must analyze a network security breach and determine which combination of security controls would have prevented the incident. (Intermediate)
- Design an idea for a complex question that requires candidates to evaluate multiple security frameworks, compare their implementation requirements, and recommend the most appropriate framework for an organization with specific compliance and operational constraints. (Hard)

**Output Format**:
<scratchpad>
[Your analysis goes here]
</scratchpad>

<idea id=1>
Idea 1: ... (Beginner)
</idea>
<idea id=2>
Idea 2: ... (Intermediate)
</idea>
<idea id=3>
Idea 3: ... (Hard)
</idea>
...`

// User prompt for generating question ideas
const ideaGenerationPrompt = `Please generate multiple choice question ideas for a CompTIA Cybersecurity assessment 
based on the following information:

Here are the learning objectives:
<learning_objectives>
{learning_objectives}
<learning_objectives>


Optional Additional Context/Requirements:
[Any additional content, context, specific requirements, or focus areas for the questions if provided will appear here]
<additional_context>
{additional_context}
</additional_context>


Generate exactly {number_of_questions} question ideas based on the learning objectives provided.
Note:
- Please organize the question ideas by topic sequence and difficulty level (Beginner, Intermediate, Hard), 
and ensure each question idea clearly indicates which learning objective it addresses.
- Ensure there are {number_of_questions} ideas in total, covering a mix of difficulties.
- Do not include ideas for topics not yet covered in the learning objectives.
`

// register the button in Coach Bot
codioIDE.coachBot.register("generateMCQButton", "Generate Multiple Choice Questions", onButtonPress)

 // function called when Generate MCQ button is pressed
async function onButtonPress() {
  try {
    // Get user input for question generation parameters
    const userInput = await getUserInput()
  
    if (!userInput) {
      codioIDE.coachBot.write("Question generation cancelled.")
      codioIDE.coachBot.showMenu()
      return
    }

    // Show thinking animation at the bottom
    codioIDE.coachBot.write("🔄 Generating question ideas from learning objectives...")
    codioIDE.coachBot.showThinkingAnimation()
  
    // Generate question ideas from learning objectives
    const questionIdeas = await generateQuestionIdeas(userInput.learning_objectives, userInput.number_of_questions, userInput.additional_context)
    
    if (!questionIdeas) {
      codioIDE.coachBot.hideThinkingAnimation()
      codioIDE.coachBot.write("❌ Failed to generate question ideas. Please try again.")
      codioIDE.coachBot.showMenu()
      return
    }
    
    codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write("✅ Question ideas generated! Now creating multiple choice assessments...")
    
    // log stuff
    await logContextAndScratchpad(questionIdeas, userInput.learning_objectives, userInput.additional_context)
    
    // Generate assessments using the question ideas
    await generateAssessments(questionIdeas, userInput.number_of_questions)
    
    // Hide thinking animation and show success message
    codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write(`✅ Successfully generated ${userInput.number_of_questions} multiple choice questions!`)
  
  } catch (error) {
    console.error("Error in MCQ generation:", error)
    codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write("❌ An error occurred while generating questions. Please try again.")
  }
   codioIDE.coachBot.showMenu()
}

// Function to get user input
async function getUserInput() {
  try {
 
    // Get learning objectives
    const learningObjectives = await codioIDE.coachBot.input("Please paste the relevant learning objectives:")
    if (!learningObjectives) return null

    // Get number of questions
    const numQuestions = await codioIDE.coachBot.input("How many questions would you like to generate")
    if (!numQuestions || isNaN(parseInt(numQuestions))) return null

    // Get optional additional context
    const additionalContext = await codioIDE.coachBot.input("Please paste any additional context (optional) you would like to provide, otherwise leave this empty and press enter!", " ")
    if (!additionalContext) return null

    return {
      learning_objectives: learningObjectives.trim(),
      number_of_questions: parseInt(numQuestions),
      additional_context: additionalContext
    }
  } catch (error) {
    console.error("Error getting user input:", error)
    return null
  }
}

// Function to generate question ideas from learning objectives
async function generateQuestionIdeas(learningObjectives, numberOfQuestions, additionalContext) {
  try {
    console.log("Generating question ideas from learning objectives:", learningObjectives)
  
    // Replace placeholders in the prompt
    const prompt = ideaGenerationPrompt
      .replace(/{learning_objectives}/g, learningObjectives)
      .replace(/{number_of_questions}/g, numberOfQuestions)
      .replace(/{additional_context}/g, additionalContext)
  
    console.log("Sending idea generation prompt to LLM...")
  
    // Send the API request to the LLM
    const result = await codioIDE.coachBot.ask(
      {
        systemPrompt: ideaGenerationSystemPrompt,
        messages: [{
          "role": "user",
          "content": prompt,
        }]
      },
      { stream: false, preventMenu: true, modelSettings: {"maxTokens": 2000} }
    )
  
    console.log("LLM Response for ideas:", result.result)
    return result.result.trim()
  
  } catch (error) {
    console.error("Error generating question ideas:", error)
    return null
  }
}

// Function to generate assessments using assessment.generate()
async function generateAssessments(questionIdeas, numberOfQuestions) {
  try {
    console.log("Generating assessments using question ideas...")
    
    const ideasList = questionIdeas.match(/<idea id=\d+>.*?<\/idea>/gs);
    console.log(`List of question ideeas`, ideasList)

    // Create one assessment for each question
    for (let i = 0; i < numberOfQuestions; i++) {
      
      console.log(`Creating assessment ${i + 1} of ${numberOfQuestions}`)
      codioIDE.coachBot.write(`Creating assessment ${i + 1} of ${numberOfQuestions}`)
      codioIDE.coachBot.showThinkingAnimation()

      // Prepare the assessment data for Codio's assessment system
      const assessmentData = {
        assessmentType: 'multiple-choice',
        guidesContent: `Question ${i + 1}`, // Simple placeholder content
        filesList: [],
        userIntro: ideasList[i] // Generated ideas are placed here
      }
      
      try {
        // Generate the assessment using Codio's assessment API
        const result = await window.codioIDE.guides.assessments.generate(assessmentData)
        console.log('Assessment generated successfully:', result)

        // Update settings before saving assessment
        result.assessment.source.showName = false
        result.assessment.source.isRandomized = true
        result.assessment.source.showGuidanceAfterResponseOption.passedFrom = 2
        result.assessment.source.maxAttemptsCount = 0

        // Save the assessment
        await window.codioIDE.guides.assessments.save(result.assessment, result.files)
        console.log('Assessment saved successfully')
      
        // Create a new page with the assessment
        const pageTitle = `${toTitleCase(result.assessment.source.name)}`
        const pageContent = `{Check it!|assessment}(${result.assessment.taskId})
        
|||guidance
## Question Idea
${ideasList[i]}
|||

`
        await window.codioIDE.guides.structure.add({
          title: pageTitle,
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: pageContent,
          layout: window.codioIDE.guides.structure.LAYOUT.L_1_PANEL,
          closeAllTabs: false,
          showFileTree: false
        }, null) // -1 adds to the end
      
        console.log(`Page ${i + 1} created successfully: ${pageTitle}`)
        codioIDE.coachBot.hideThinkingAnimation()
        codioIDE.coachBot.write(`Page ${i + 1} with an MCQ created successfully: ${pageTitle}`)

      
      } catch (assessmentError) {
        console.error(`Error creating assessment ${i + 1}:`, assessmentError)
      
        // Fallback: create a simple page with the question ideas
        const fallbackContent = `## Exercise ${i + 1} - Multiple Choice Question

### Question Ideas:
${questionIdeas}

*Note: Assessment generation failed. Please try again or contact support.*`

        await window.codioIDE.guides.structure.add({
          title: `Exercise ${i + 1} - MCQ (Fallback)`,
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: fallbackContent,
          layout: window.codioIDE.guides.structure.LAYOUT.L_1_PANEL,
          closeAllTabs: false,
          showFileTree: false
        }, null, -1)
        codioIDE.coachBot.hideThinkingAnimation()

        console.log(`Fallback page ${i + 1} created successfully`)
      }
    }
  
  } catch (error) {
    console.error("Error generating assessments:", error)
    throw error
  }
}

async function logContextAndScratchpad(questionIdeas, learningObjectives, additionalContext) {

    const scratchpad = extractSubstringFromContent(questionIdeas, startingFrom="<scratchpad>", endingAt="</scratchpad>")

    const randomStringForLogs = `${new Date(Date.now())}`

    const learning_objectives_fp = `.guides/secure/logs/${randomStringForLogs}/learningObjectives.txt`
    const scratchpad_fp = `.guides/secure/logs/${randomStringForLogs}/scratchpad.txt`
    const additional_context_fp = `.guides/secure/logs/${randomStringForLogs}/additionalContext.txt`

    try {
        const lrnObjRes = await window.codioIDE.files.add(learning_objectives_fp, learningObjectives)
        console.log('add file result', lrnObjRes) 

        const scrRes = await window.codioIDE.files.add(scratchpad_fp, scratchpad)
        console.log('add file result', scrRes) 

        const addConRes = await window.codioIDE.files.add(additional_context_fp, additionalContext)
        console.log('add file result', addConRes) 

    } catch (e) {
        console.error(e)
    }


}

function extractSubstringFromContent(content, startingFrom="", endingAt="") {
      
    const startIndex = content.indexOf(`${startingFrom}`) + `${startingFrom}`.length;
    if (endingAt === "") {
    return content.slice(start=startIndex)
    } else {
    const endIndex = content.indexOf(`${endingAt}`, startIndex);
    return content.substring(startIndex, endIndex); 
    }
}

function toTitleCase(str) {
  if (!str) {
    return ""; // Handle empty or null strings
  }
  return str
    .toLowerCase()
    .split(' ')
    .map(function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// calling the function immediately by passing the required variables
})(window.codioIDE, window)
